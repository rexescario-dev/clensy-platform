# Laundry Price Preview and Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan.**

| Field | Value |
| --- | --- |
| Status | **Accepted (revision 3)** at M5, 2026-10-16. M6 complete ([Execution record](#execution-record)); M7 **Approved for merge** (independent review). |
| M5 decision | **Accepted** — 2026-10-16, revision 3 (`103bbcc`), by the owner's reviewer, after a final six-part review. "I have no remaining M5 blocker based on the plan text and review evidence provided." Rounds 1 and 2 returned the plan for revision; round 3 accepted the round-2 fixes. The final six-part pass raised P1-01 (role names), a `Button` markup check, P2-1 (withdrawn by the reviewer), P2-2 (committed-render recording) and one Part 5 cleanup, each resolved in the revisions log. The owner put the Weighing inconsistency in the PRICED-without-total rows out of scope.<br>The acceptance covers the plan, not the implementation. The reviewer read the supplied parts and did not inspect the branch or run any command. M6 must record real red/green and verification results, and M7 is an independent review of the branch diff against the Accepted spec. |
| Date | 2026-10-15 |
| Tracking issue | [#162](https://github.com/rexescario-dev/clensy-platform/issues/162) "Laundry price preview and confirmation". Epic [#154](https://github.com/rexescario-dev/clensy-platform/issues/154). Depends on [#156](https://github.com/rexescario-dev/clensy-platform/issues/156) (merged in #183: the order page), [#159](https://github.com/rexescario-dev/clensy-platform/issues/159) (merged in #184: `previewLaundryOrderPrice`, frozen `description`) and [#158](https://github.com/rexescario-dev/clensy-platform/issues/158) (merged in #186: the selection hook and Services editor). |
| Branch | `feat/162-laundry-price-review`, from `main` at `47e90b1`. One PR for this plan, its M5 record and the implementation. |
| Scope | `apps/web`: a new pure module, a new confirm hook, a new price card component, changes to the selection hook, both editors and the order page, and tests. `packages/web`: `laundry.order.price.*` copy, plus removal of copy that only the removed UI used. **No** API, schema, migration, resolver, GraphQL type, operation document, codegen or `@clensy/ui` change. No new dependency. The list page and drawer are not edited. |
| Implements (Accepted) | [Laundry Orders & Lifecycle](../specs/2026-09-06-laundry-orders-lifecycle-design.md), Status **Accepted** (2026-09-06), with **Amendment #164**, Accepted 2026-10-10. Governing text: **§8.4.4**, estimate bullet ("Before `priceLaundryOrder`, displayed amounts are an estimate from §8.4.5. Confirming price is `priceLaundryOrder`, once. After `PRICED`, the page shows the frozen snapshot, not a new estimate."), Services bullet ("The client does not compute the amount."). **§8.4.5** (the preview: same input as `priceLaundryOrder`, `WEIGHED` only, writes nothing). **§8.4.2** (a priced line shows its frozen `description`). **§4.4** (`priceLaundryOrder` roles OWNER, OPS_MANAGER, SCHEDULER). **§4.5** and **§8.6** (post-`PRICED` immutability; no price edit). **§4.3 note 5** (`PRICED → CANCELLED` is legal, so a cancelled order may carry a total). |
| Relies on (Accepted, merged) | [Laundry Services Selection plan](2026-10-15-laundry-services-selection-plan.md) (#158): `useLaundryServiceSelection`, `LaundryServicesEditor`, `laundryServicesView`, `PricingSections`, `laundryRateKey`, the editor and hook jsdom harnesses. [Laundry Order Page plan](2026-10-14-laundry-order-page-plan.md) (#156): the route, `OrderSection`, the render-test harness, `currentLaundryOrderSection`. [Multi-entry Laundry Weighing plan](2026-10-14-multi-entry-laundry-weighing-plan.md) (#155): `LaundryWeighingEditor`, its synchronous in-flight guard, `graphQLErrorMessage`, `laundryLineQuantity`. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. Issue #162 refines §8.4.4 with layout, copy, behavior and test requirements. File names, helper names, copy keys, element ids and task order are planning decisions, not product semantics. |
| Owner decisions (brainstorm, 2026-10-15) | See [Owner decisions](#owner-decisions) 1–6. None changes the pricing contract, so no spec amendment is needed. Decision 1 revises #158's owner decision 1 (which section lists a priced order's lines). That was a UI-ownership decision of the #158 plan, not spec text. |
| Planning decisions for M5 to confirm | See [Planning decisions](#planning-decisions-for-m5-to-confirm) (a)–(g). |
| Edit anchors | New files are given in full. Edits to existing files are given against `main` at `47e90b1`. Apply each by the quoted code, not by line number. |
| Package names | `pnpm --filter web` is `apps/web`. `pnpm --filter @clensy/web` is `packages/web`. `pnpm --filter api` is `apps/api`. |
| Pre-validation | **None.** No code in this plan was run before M5. Every `Expected:` line is a prediction until M6 records the actual result. |
| M7 | Application code changes. `CLAUDE.md` requires a **fresh independent reviewer** on the most capable model, given this plan, the Accepted spec and the branch diff. M5 acceptance of this plan is not a substitute for that review. |

**Goal:** On `/app/laundry/<id>`, the Price section is replaced:
- An operational role on a `WEIGHED` order sees an **Estimate** card built from #158's current preview, with a **Confirm price** button that calls `priceLaundryOrder` once.
- Everyone sees a **Final price** card from the persisted snapshot once the order has a total.
- Everyone else sees one sentence.

The Price section becomes the one place that shows rates, amounts and totals. The client never computes one.

**Architecture:**

- **Pure module (`apps/web/lib/laundry-price-review.ts`):**
  - `laundryPriceView`: the Price view table (owner decision 5).
  - `laundryEstimateState`: the Estimate card states (owner decision 3).
  - `laundryPreviewRows` / `laundrySnapshotRows`: map server lines to display rows. They only select and format; there is no arithmetic.
- **Selection hook (`use-laundry-service-selection.ts`):** the three #158 M7 carry-forwards. It skips a redundant request when an A→B→A return lands on a result that is still current, adds `retryPreview()`, and exposes `complete`.
- **Confirm hook (`apps/web/lib/use-confirm-laundry-price.ts`):** `priceLaundryOrder` behind a synchronous ref guard, with the toast and a refetch on success and on failure. The failure is tagged with the selection it was confirmed with.
- **Price card (`apps/web/components/laundry/laundry-price-card.tsx`):** presentational. It has an `estimate` mode and a `final` mode.
- **Editors:** the Services editor drops its unit display, rate phrase and note (owner decision 2). Both editors take a `disabled` prop (owner decision 6.3).
- **Page:**
  - `LaundryOrderWorkspace` owns the confirm hook and disables both editors while it runs.
  - `PricingSections` renders the Price body from `laundryPriceView`.
  - Services drops its saved-line list, and Overview links to Price (owner decision 1).

**Tech Stack:** React 19, Next.js 16, Apollo Client 3.14 (`@clensy/client` generated hooks and documents), Tailwind 4 (`tabular-nums` is built in), Vitest (node `renderToStaticMarkup`, and jsdom with `createRoot` + `act`).

**Spec:** `docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md` §8.4.4, §8.4.5, §8.4.2 (with §4.3 note 5, §4.4, §4.5, §8.6).

---

## Owner decisions

These were recorded from the brainstorm with the owner on 2026-10-15. Each one binds this plan.

1. **Price owns the breakdown (revises #158 owner decision 1).**
   - *Before pricing:* Price shows the full Estimate breakdown from the **current** preview: name, unit, quantity, rate, amount, the minimum-charge note, and the estimated total. Services is where staff choose services and enter counts. It does not repeat the breakdown.
   - *After pricing:* Price shows the full Final breakdown from the persisted snapshots: frozen descriptions, quantities, rates, amounts, minimum-charge notes, and `totalMinorUnits`. Services shows only the locked sentence.
   - *Overview:* the priced-order link changes from `#laundry-order-services` to `#laundry-order-price`.
   - *No client arithmetic:* every rate, quantity, amount, flag and total comes from the preview or the snapshot. The client formats them and never calculates them.
   - *Freshness:* the estimate comes from the current preview only, never from remembered units or catalog prices. A failed, stale or pending preview never leaves an old breakdown looking current, and never enables Confirm.
2. **The Services editor keeps only selection.**
   - *Kept:* the pickers, the count input when the remembered unit is `PER_ITEM`, the row errors (no current price, duplicate, empty row, invalid count), and the section alert for a failed preview.
   - *Removed:* the unit display ("Priced by weight" with the kg, and "Flat price"), the rate phrase, and the note "This is a preview…".
   - The remembered unit decides only whether the count input shows. It never makes a price valid.
3. **Estimate card states.** The eyebrow "Estimate" shows in every state, and so does the confirm caption.

   | # | Condition | Card body | Confirm |
   |---|---|---|---|
   | 1 | No base service | "Select a base service to see an estimate." | Disabled |
   | 2 | Complete selection, current preview ready | Full breakdown and estimated total | Enabled |
   | 3 | Preview loading (debounce or request) | "Updating estimate…" in an `aria-live="polite"` region. No breakdown, no total | Disabled |
   | 4 | Preview failed | A failure message and a **Try again** button that calls `retryPreview()`. The row-specific missing-price message stays beside its row in Services | Disabled |
   | 5 | Selection incomplete or invalid (an empty add-on row, or an invalid count) | "Finish choosing services to see an estimate." No breakdown, no total, even if a preview exists for the valid part | Disabled |

   - **Retry** issues a real new request for the same input, under a new generation. It keeps the selection and the count text. Confirm stays disabled until the retry succeeds for the current key and the selection is complete.
   - **Readiness** is never inferred from `preview` alone. `ready`, the current key, completeness and the loading and error state must all agree.
4. **The nav marker is unchanged.** `currentLaundryOrderSection` keeps mapping `price` to **Services** (#156 M4). It stays based on order-level state only, never on the selection or the preview.
5. **The Price view table, in precedence order.**
   1. A persisted total means **Final price**, whatever the status or role, including while the role loads.
   2. Otherwise, any status other than `RECEIVED` or `WEIGHED` shows "This order was not priced.": `CANCELLED` and `REJECTED`, and the inconsistent case of a later status with no total. It never falls through to the Estimate card, even if preview data is still in memory.
   3. Otherwise, while the role is unresolved, the section shows nothing, the same guard #158 uses.
   4. `WEIGHED` with permission to `price` shows the **Estimate** card (decision 3).
   5. `RECEIVED`, and `WEIGHED` without `price`, show "Price is available after the order is weighed and services are chosen." This is the issue's wording, kept as is.
6. **Confirm flow.**
   1. *Input:* send the hook's `priceInput` exactly as previewed.
   2. *Guard:* a ref is set synchronously before any `await`, so a double click sends one request. The button reads "Confirming…" and is disabled.
   3. *Frozen editors:* the Services and Weighing editors are disabled through the mutation **and** the refetch.
   4. *Success:* toast "Price confirmed.", then await the refetch. The card switches to Final when the status is `PRICED`.
   5. *Failure:* an alert shows the server message or "Unable to price order.". Selections stay, the order is refetched, and the guard is released and editing re-enabled once the refetch settles. The alert clears on the next selection change or Confirm. If the refetch fails, the page's existing order-error state takes over, and nothing assumes the order is still priceable.

**Outcome table (M5 round 1).** Every status, with and without a persisted total, for Price (decision 5) and Services (planning decision a). "Operational" is TENANT_OWNER, OPS_MANAGER or SCHEDULER, the roles `laundryOrderActions` gives `price` on WEIGHED (§4.4).

| Status | Total | Role | Price | Services |
|---|---|---|---|---|
| any | set | any, including loading | Final price, no Confirm | Locked sentence |
| RECEIVED | null | loading | Nothing | "Weigh the order before choosing services." |
| RECEIVED | null | any resolved role | "Price is available after …" | "Weigh the order before choosing services." |
| WEIGHED | null | loading | Nothing | Nothing |
| WEIGHED | null | operational | Estimate card, Confirm | Editor |
| WEIGHED | null | other resolved role | "Price is available after …" | "No services selected yet." |
| CANCELLED, REJECTED | null | any, including loading | "This order was not priced." | "No services selected yet." |
| PRICED and every later status (inconsistent: the API never leaves these without a total) | null | any, including loading | "This order was not priced." | "No services selected yet." |

No row without a total reaches the Estimate card except WEIGHED for an operational role. The inconsistent rows are safe and non-editable. **Out of scope (owner, 2026-10-16):** in the inconsistent PRICED-and-later rows, Weighing (#155) still shows its status-based locked sentence. #162 does not change Weighing. Task 1 pins each row, by literal tests and by the exhaustive matrix; Task 6 renders the CANCELLED/REJECTED, inconsistent PRICED, and later-status-with-total rows.

**M5-requested precisions folded in at design approval:** see owner decisions 3 and 5. Section 2 also asked for three corrections:
- the renamed priced-order render test (Task 6, Step 1);
- a synchronous double invocation, plus editors disabled through the refetch on failure as well as on success (Task 3, Task 6);
- explicit invalid status/total rows in the view-selector test (Task 1).

## Planning decisions for M5 to confirm

These are not in the issue, the spec, or the owner decisions above. Each is the smallest choice that keeps the stated contract, and M5 may return any of them.

- **(a) Services is keyed on the total, not on saved lines (revised at M5 round 1).** #158 showed a `CANCELLED` / `REJECTED` order's saved lines with no locked sentence (its owner decision 4). Lines now live in Price (decision 1), so that `lines` view goes away. `laundryServicesView` takes `hasTotal` (`order.totalMinorUnits !== null`) in place of `hasLines`:
  - a total → `locked`, "Services are locked because this order has been priced.", whatever the status. This is the same signal that selects Price's Final card, so the two sections never disagree;
  - no total → never `locked`. Outside RECEIVED and WEIGHED it is `none`, "No services selected yet.", next to Price's "This order was not priced.".

  Evidence that the total is the right signal: the API writes order lines and `totalMinorUnits` only inside `price()` (`apps/api/src/modules/laundry/application/services/laundry-orders.service.ts`), in one transaction that also sets `PRICED`. Choosing services in the editor writes nothing; it drives the non-saving preview (§8.4.5). An order cancelled after pricing keeps its total (§4.3 note 5). The Weighing view (#155) is unchanged and still locks by status.
- **(b) Row layout.**
  - Each row is a two-column grid: the text on the left, the amount on the right. The left column holds the name, then the quantity in its unit when there is one ("2.505 kg", "3 items", "1 item"), then the rate phrase ("₱50.00 per kg", "₱25.00 per item", "₱150.00 flat"). Each is its own `<p>`.
  - The rate phrase carries the unit, so there is no separate "Per kg" label. This is the issue's "unit phrase … rate".
  - The minimum-charge note spans both columns, under the row.
- **(c) Minimum-charge copy when the server's minimum is `null`.** The issue's "Minimum charge applied ({formatted minimum})." needs an amount. If `minimumChargeApplied` is true but `minimumChargeMinorUnits` is `null` (the type allows it), the row reads "Minimum charge applied." The client invents no amount.
- **(d) Failure message in the card (state 4).** "Couldn’t calculate the estimate." matches the Services copy's "Couldn’t …" form. The Services alert keeps its own message ("{name} has no current price." or the raw server text).
- **(e) Clearing the confirm alert.** The failure is stored with the `LaundryServiceSelection` object Confirm used. The card shows it only while `selection.selection` is that same object. Every edit or touch creates a new object, so the next change clears it with no effect hook. While confirming, the editors are disabled, so the object cannot change mid-flight.
- **(f) Estimate fallback.** If the hook reports a complete selection that is neither loading, failed nor ready, the card shows the `failed` state, not `loading`. That combination is unreachable today (`ready` is `complete && preview && !loading`, and a mismatched preview sets `previewError`). If it ever happens, Try again is a way out, where "Updating estimate…" would wait forever.
- **(g) Removed copy.** These keys are removed after a grep across `apps/` and `packages/` confirms no other user:
  - `order.lines.*`;
  - `order.unit.*`;
  - `order.overview.seeServices`, replaced by `seePrice`;
  - `order.services.byWeight`, `order.services.flat`, `order.services.note` and `order.services.rate.*`, the last moved to `order.price.rate.*`.

  `order.price.notPriced` changes from "Not priced yet." to "This order was not priced.". The before-pricing case now has its own key.

## M5 round 1 revisions

M5 round 1 (2026-10-15) reviewed the plan in five passes and returned it for revision. Each finding, and what changed:

| Pass | Finding | Disposition |
|---|---|---|
| Design | (a) treats saved lines as proof of pricing | **Revised.** Services is keyed on the total, the same signal as Price; see planning decision (a), with the API evidence. |
| Design, Tasks 3–4, Tasks 6–7 | Source of "More lines are not loaded." | **Already grounded; now cited.** `order.lines.pageInfo.hasNextPage`, from the #156 query; present in the generated `LaundryOrderQuery` type as `boolean \| null`. The page passes `more={… === true}` (Task 6) and never infers it from a row count. No API change. |
| Design, Tasks 6–7 | Outcomes for every status/total pair | **Added** the outcome table under owner decisions, plus Task 6 render tests for PRICED with no total and a later status with a total. |
| Design | Tasks missing from the review copy | Resolved: the review received all tasks. |
| Tasks 1–2 | Roles hard-coded in the test helper | No change. The literal role-set test keeps the helper and `laundryOrderActions` aligned. |
| Tasks 1–2 | `pricingSnapshot` might be null | **Verified non-null** in the generated type; noted in Task 1 Interfaces. |
| Tasks 1–2 | Test count | The earlier text already said "plus the named cases"; now an exact count: 502. |
| Tasks 1–2 | `retryPreview()` not a true no-op | **Fixed:** early return when there is no key; case 22 asserts no render. |
| Tasks 1–2 | `complete` undefined | **Cited:** it already exists in the hook (line 183), built from `previewInputFromSelection`; Task 2 Interfaces quote it. |
| Tasks 1–2 | A→B→A after a failure | **Added** hook case 24. |
| Tasks 3–4 | Page behavior on a failed refetch | Already pinned by interaction case 10. |
| Tasks 3–4 | Apollo result and error types | **Verified:** Apollo 3.14 resolved results carry `errors`; the call matches `laundry-weighing-editor.tsx:135`. |
| Tasks 3–4 | `ready` with a null total | **Fixed:** the card shows `failed`; card case 8. |
| Tasks 3–4 | Stale preview, loading, retry, Final from saved data | Pinned by interaction cases 2, 11, 12, card case 3, render cases; **added** interaction case 13 (base change after ready). |
| Tasks 3–4 | Alert clearing at the page | Already pinned by interaction case 7 and hook case 7. |
| Tasks 3–4 | Copy paths, network fallback | **Verified:** keys sit under `laundry.order.price`; `graphQLErrorMessage` returns `undefined` for a plain `Error`, so the fallback shows. |
| Task 5 | Disabled submit must be cancelled | Already true (`preventDefault()` first); **added** the `dispatchEvent(...) === false` assertion. |
| Task 5 | Combobox honors `disabled` | **Verified:** `packages/web/src/laundry/laundry-search-combobox.tsx:153` disables the input, and the list renders only when expanded. |
| Task 5 | Count validity independent of blur | Already true (`previewInputFromSelection` never reads `quantityTouched`); hook case 23 now asserts it with an unblurred `0`. |
| Task 5 | Disabled tests by name; add/remove while disabled | **Revised** editor case 20; **added** case 21. |
| Task 5 | Grep before removing copy; focus effect on `pending` | Already steps of the plan; unchanged. |
| Tasks 6–7 | Terminal render test contradicts itself | **Revised** with planning decision (a). |
| Tasks 6–7 | Refetch test double | **Revised:** `settleRefetch` sets the resulting query state, settles the promise and re-renders; its comment says it does not exercise Apollo's refetch. |
| Round 2 | `laundryServicesView` checked the verb before the unresolved role | **Fixed:** the role check comes first; Task 1 adds the WEIGHED, role-loading, `price`-verb case. `laundryPriceView` already checked the role before the verb. |
| Round 2 | The cited role-loading test named only Services | **Revised:** the test is renamed and asserts the empty Price body, with no Estimate, Confirm or fallback sentence. |
| Round 2 | "any" in the outcome table overlapped "loading" | **Revised:** rows read "any resolved role" or "any, including loading". |
| Final review | `OWNER` in the spec, `TENANT_OWNER` in the plan (P1-01) | **Clarified:** the same role; recorded under Global constraints with the code references. |
| Final review | `Button` markup assumed by the card's regexes | **Verified:** `packages/ui/src/base/button.tsx` renders a native `<button>` with `{...props}`, so the children are its direct content. |
| Final review | The role-loading render test rendered the page twice | **Fixed:** Services and Price are read from one `html`. |
| Final review | The hook harness recorded renders during render, not on commit (P2-2) | **Fixed:** `renders` is pushed from a `useLayoutEffect` in `Probe`, so only committed results are checked. Case 20 (ready) and case 24 (failed) both assert over the committed results after the return to A. |
| Tasks 6–7 | Catalog mock shape | **Revised** to the generated `ServicesQuery` / `AddOnsQuery` node shapes with `pageInfo`. Neither query has a pricing unit: the unit comes from the preview (#158), so the review's "include the unit" premise does not apply. The wrong catalog price stays. |

## Global constraints

- SHALL call `priceLaundryOrder` only from Confirm, once per click, with the hook's `priceInput` unchanged (§8.4.4; decision 6.1).
- SHALL NOT call `generateInvoiceFromOrder`, `markLaundryOrderPaid`, or any mutation other than `priceLaundryOrder` (issue Confirm behavior).
- SHALL NOT compute an amount, a rate × quantity, a minimum or a total in the client. Every figure shown comes from a preview line, `estimatedTotalMinorUnits`, a `pricingSnapshot` or `totalMinorUnits` (§8.4.4; issue Acceptance).
- SHALL NOT call the preview once the order has a total. The selection hook is disabled because the Services view is no longer `editor` (issue Layout: "Preview is illegal once priced").
- SHALL NOT add an edit-price or reprice action (§8.6; issue Immutability).
- SHALL NOT use "Total due" or "Invoice" wording in the card (issue Layout).
- SHALL NOT change `currentLaundryOrderSection`, the Invoice or Actions bodies, the list page or the drawer (decision 4).
- SHALL keep the eyebrow "Estimate" wherever a figure comes from the preview, and "Final price" wherever it comes from the snapshot (issue Acceptance).
- SHALL show the Confirm control only in the Estimate card, which only an operational role on a `WEIGHED` order sees (§4.4; decision 5).
- Role names: the spec's §4.4 table writes `OWNER` as shorthand for the `TENANT_OWNER` role; its §8.4.5 spells out "TENANT_OWNER, OPS_MANAGER, SCHEDULER". The code uses `TENANT_OWNER` (`apps/api/src/modules/laundry/presentation/graphql/laundry-order.resolver.ts:23`, `packages/web/src/laundry/laundry-order-actions.ts:88`), and no role named `OWNER` exists. This plan uses `TENANT_OWNER` throughout.

## Review focus

These are the input classes most likely to bite a user that the issue does not spell out. Each line names the test that pins it.

1. **A re-weigh after the estimate is shown.** The quote is stale, so the card goes back to "Updating estimate…" and Confirm is disabled until the new preview arrives (Task 6, interaction case 11).
2. **Another actor prices or cancels the order before Confirm lands.** The mutation fails, the refetch shows the true status, and no dead Confirm remains (Task 6, interaction case 9).
3. **A long service name.** It wraps in the left column and the amount stays right-aligned, because of `minmax(0,1fr)`. Pinned by class in Task 4, case 7, and by the browser check in Task 7.
4. **A minimum charge flagged without a minimum amount.** It reads "Minimum charge applied." and invents no figure (Task 1, rows case 3; Task 4, case 5).
5. **A snapshot list longer than the loaded page.** The Final card shows the loaded rows, the total, and "More lines are not loaded.", and adds no rows (Task 4, case 6; Task 6, render case 10).

## File map

| File | Change | Responsibility |
|---|---|---|
| `apps/web/lib/laundry-price-review.ts` | Create | `laundryPriceView`, `laundryEstimateState`, `laundryPreviewRows`, `laundrySnapshotRows`, `LaundryPriceRow` |
| `apps/web/lib/laundry-price-review.test.ts` | Create | Table tests for the three |
| `apps/web/lib/laundry-service-selection.ts` | Modify | `laundryServicesView` keyed on `hasTotal`; the `lines` view removed (planning decision a) |
| `apps/web/lib/laundry-service-selection.test.ts` | Modify | The view matrix on `hasTotal` |
| `apps/web/lib/use-laundry-service-selection.ts` | Modify | A→B→A early return, `retryPreview`, `complete` |
| `apps/web/lib/use-laundry-service-selection.hook.test.tsx` | Modify | Cases 20–24 |
| `apps/web/lib/use-confirm-laundry-price.ts` | Create | `useConfirmLaundryPrice` |
| `apps/web/lib/use-confirm-laundry-price.hook.test.tsx` | Create | Guard, success, failure, refetch |
| `apps/web/components/laundry/laundry-price-card.tsx` | Create | `LaundryPriceCard` (estimate / final) |
| `apps/web/lib/laundry-price-card.render.test.tsx` | Create | Static markup per state |
| `apps/web/components/laundry/laundry-services-editor.tsx` | Modify | Drop unit display, rate, note; add `disabled` |
| `apps/web/lib/laundry-services-editor.interaction.test.tsx` | Modify | Remove rate/unit/note assertions; add `disabled` case |
| `apps/web/components/laundry/laundry-weighing-editor.tsx` | Modify | Add `disabled` |
| `apps/web/lib/laundry-weighing-editor.interaction.test.tsx` | Modify | Add `disabled` case |
| `apps/web/app/app/laundry/[id]/page.tsx` | Modify | Wire the confirm hook, Price body, Services body, Overview link |
| `apps/web/lib/laundry-order-page.render.test.tsx` | Modify | Narrow the controls test; Price assertions |
| `apps/web/lib/laundry-order-page.interaction.test.tsx` | Create | The page's confirm flow in jsdom |
| `packages/web/src/i18n/messages/en/laundry.ts` | Modify | `order.price.*` added; removed keys (g) |
| `docs/superpowers/plans/2026-10-15-laundry-price-review-plan.md` | Modify (M6+) | Execution record |

---

### Task 1: Pure price-review module

Implements decisions 1, 3, 5; planning decisions (b), (c), (f); §8.4.4 ("The client does not compute the amount").

**Files:**
- Create: `apps/web/lib/laundry-price-review.ts`
- Test: `apps/web/lib/laundry-price-review.test.ts`
- Modify: `apps/web/lib/laundry-service-selection.ts` (`laundryServicesView`, planning decision a)
- Test: `apps/web/lib/laundry-service-selection.test.ts`

**Interfaces:**
- Consumes: `laundryLineQuantity(unit, quantity): LaundryLineQuantity` and `LaundryLineQuantity` from `./laundry-order-page`; `laundryRateKey(unit): LaundryRateKey`, `LaundryRateKey` and `LaundryPreviewLine` from `./laundry-service-selection`.
- Produces:
  - `type LaundryPriceView = 'beforePricing' | 'estimate' | 'final' | 'hidden' | 'notPriced'`
  - `laundryPriceView(input: { hasTotal: boolean; roleResolved: boolean; status: LaundryOrderStatus; verbs: readonly LaundryOrderVerb[] }): LaundryPriceView`
  - `type LaundryEstimateState = 'failed' | 'incomplete' | 'loading' | 'noBase' | 'ready'`
  - `laundryEstimateState(input: { complete: boolean; hasBase: boolean; previewError: boolean; previewLoading: boolean; ready: boolean }): LaundryEstimateState`
  - `interface LaundryPriceRow { amountMinorUnits: number; key: string; minimumCharge: { minorUnits: number | null } | null; name: string; quantity: LaundryLineQuantity; rateKey: LaundryRateKey; rateMinorUnits: number }`
  - `laundryPreviewRows(lines: readonly LaundryPreviewLine[]): LaundryPriceRow[]` (keys `preview-<index>`)
  - `laundrySnapshotRows(lines: readonly LaundrySnapshotLine[]): LaundryPriceRow[]` (keys are line ids), where `LaundrySnapshotLine = NonNullable<LaundryOrderQuery['laundryOrder']>['lines']['nodes'][number]`. `pricingSnapshot` is non-null in the generated `LaundryOrderQuery` type (`packages/client/src/generated/graphql.ts`); only `minimumChargeMinorUnits` is nullable, handled by planning decision (c).
  - Changed: `LaundryServicesView = 'beforeWeigh' | 'editor' | 'hidden' | 'locked' | 'none'` (`lines` is removed), and `LaundryServicesViewInput.hasLines` is replaced by `hasTotal: boolean` (`order.totalMinorUnits !== null`).

- [ ] **Step 1: Write the failing tests**

Create `apps/web/lib/laundry-price-review.test.ts`:

```ts
import type { LaundryOrderQuery } from '@clensy/client';
import {
  ADMIN_ROLES,
  LAUNDRY_ORDER_STATUSES,
  laundryOrderActions,
  type AdminRole,
  type LaundryOrderStatus,
} from '@clensy/web';
import { describe, expect, it } from 'vitest';
import {
  laundryEstimateState,
  laundryPreviewRows,
  laundryPriceView,
  laundrySnapshotRows,
  type LaundryEstimateState,
} from './laundry-price-review';
import type { LaundryPreviewLine } from './laundry-service-selection';

type SnapshotLine = NonNullable<LaundryOrderQuery['laundryOrder']>['lines']['nodes'][number];

// The roles that may price (spec §4.4).
const OPERATIONAL: ReadonlySet<AdminRole> = new Set<AdminRole>(['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER']);

describe('laundryPriceView', () => {
  // Owner decision 5, in precedence order. Exhaustive over the real status
  // and role lists, both fulfillment types, total yes/no and role loading.
  function expected(status: LaundryOrderStatus, role: AdminRole | undefined, hasTotal: boolean) {
    if (hasTotal) return 'final';
    if (status !== 'RECEIVED' && status !== 'WEIGHED') return 'notPriced';
    if (role === undefined) return 'hidden';
    if (status === 'WEIGHED' && OPERATIONAL.has(role)) return 'estimate';
    return 'beforePricing';
  }

  it('covers all 15 statuses and all 7 roles', () => {
    expect(LAUNDRY_ORDER_STATUSES).toHaveLength(15);
    expect(ADMIN_ROLES).toHaveLength(7);
  });

  for (const status of LAUNDRY_ORDER_STATUSES) {
    for (const fulfillment of ['PICKUP', 'DELIVERY'] as const) {
      for (const hasTotal of [false, true]) {
        for (const role of [undefined, ...ADMIN_ROLES]) {
          it(`${status}, ${fulfillment}, total ${String(hasTotal)}: ${role ?? 'role loading'}`, () => {
            const verbs = laundryOrderActions(status, fulfillment, role);
            expect(laundryPriceView({ hasTotal, roleResolved: role !== undefined, status, verbs })).toBe(
              expected(status, role, hasTotal),
            );
          });
        }
      }
    }
  }

  // M5 Section 2 correction 3: the precedence rules most likely to regress,
  // pinned by literals rather than by `expected`.
  it.each(['CANCELLED', 'REJECTED'] as const)('%s without a total is notPriced, even with a forced price verb', (status) => {
    expect(laundryPriceView({ hasTotal: false, roleResolved: true, status, verbs: ['price'] })).toBe('notPriced');
    expect(laundryPriceView({ hasTotal: false, roleResolved: false, status, verbs: [] })).toBe('notPriced');
  });

  it('any status with a total is final, even while the role loads', () => {
    for (const status of LAUNDRY_ORDER_STATUSES) {
      expect(laundryPriceView({ hasTotal: true, roleResolved: false, status, verbs: [] })).toBe('final');
      expect(laundryPriceView({ hasTotal: true, roleResolved: true, status, verbs: ['price'] })).toBe('final');
    }
  });

  it('a status that implies pricing but has no total is notPriced, never estimate', () => {
    for (const status of ['PRICED', 'AWAITING_PAYMENT', 'PAID', 'PROCESSING', 'READY', 'COMPLETED', 'REFUNDED'] as const) {
      expect(laundryPriceView({ hasTotal: false, roleResolved: true, status, verbs: ['price'] })).toBe('notPriced');
    }
  });

  it('WEIGHED without the price verb is beforePricing', () => {
    expect(laundryPriceView({ hasTotal: false, roleResolved: true, status: 'WEIGHED', verbs: [] })).toBe('beforePricing');
  });

  it('WEIGHED with the role unresolved and no total is hidden', () => {
    expect(laundryPriceView({ hasTotal: false, roleResolved: false, status: 'WEIGHED', verbs: [] })).toBe('hidden');
  });

  it('shows the estimate for exactly WEIGHED × TENANT_OWNER, OPS_MANAGER, SCHEDULER', () => {
    const estimates = new Set<string>();
    for (const status of LAUNDRY_ORDER_STATUSES) {
      for (const role of ADMIN_ROLES) {
        for (const fulfillment of ['PICKUP', 'DELIVERY'] as const) {
          const verbs = laundryOrderActions(status, fulfillment, role);
          if (laundryPriceView({ hasTotal: false, roleResolved: true, status, verbs }) === 'estimate') {
            estimates.add(`${status}:${role}`);
          }
        }
      }
    }
    expect([...estimates].sort()).toEqual(['WEIGHED:OPS_MANAGER', 'WEIGHED:SCHEDULER', 'WEIGHED:TENANT_OWNER']);
  });
});

describe('laundryEstimateState', () => {
  const READY = { complete: true, hasBase: true, previewError: false, previewLoading: false, ready: true };

  it.each<[string, Partial<typeof READY>, LaundryEstimateState]>([
    ['ready', {}, 'ready'],
    // noBase wins over everything, including leftover rows and a loading preview.
    ['no base', { complete: false, hasBase: false, previewLoading: true, ready: false }, 'noBase'],
    ['no base, with an error', { hasBase: false, previewError: true, ready: false }, 'noBase'],
    // incomplete wins over loading and over a preview for the valid part.
    ['incomplete while loading', { complete: false, previewLoading: true, ready: false }, 'incomplete'],
    ['incomplete with a failure', { complete: false, previewError: true, ready: false }, 'incomplete'],
    ['incomplete, hook not ready', { complete: false, ready: false }, 'incomplete'],
    ['loading', { previewLoading: true, ready: false }, 'loading'],
    ['failed', { previewError: true, ready: false }, 'failed'],
    // Planning decision (f): unreachable today; offers Try again.
    ['complete, idle, not ready', { ready: false }, 'failed'],
  ])('%s', (_label, change, state) => {
    expect(laundryEstimateState({ ...READY, ...change })).toBe(state);
  });

  it('is never ready unless the hook says ready', () => {
    for (const complete of [false, true]) {
      for (const hasBase of [false, true]) {
        for (const previewError of [false, true]) {
          for (const previewLoading of [false, true]) {
            expect(laundryEstimateState({ complete, hasBase, previewError, previewLoading, ready: false })).not.toBe('ready');
          }
        }
      }
    }
  });
});

describe('price rows', () => {
  function previewLine(overrides: Partial<LaundryPreviewLine>): LaundryPreviewLine {
    return {
      addOnId: null,
      amountMinorUnits: 0,
      description: 'Line',
      minimumChargeApplied: false,
      minimumChargeMinorUnits: null,
      quantity: 1,
      rateMinorUnits: 0,
      serviceId: null,
      unit: 'FLAT',
      ...overrides,
    };
  }

  it('case 1: maps each unit to its quantity and rate key, keyed by position', () => {
    const rows = laundryPreviewRows([
      previewLine({ description: 'Wash', quantity: 2505, rateMinorUnits: 5000, serviceId: 's1', unit: 'PER_KG' }),
      previewLine({ addOnId: 'a1', description: 'Ironing (add-on)', quantity: 3, rateMinorUnits: 2500, unit: 'PER_ITEM' }),
      previewLine({ addOnId: 'a2', description: 'Softener (add-on)', rateMinorUnits: 15000, unit: 'FLAT' }),
      previewLine({ addOnId: 'a3', description: 'Duvet (add-on)', rateMinorUnits: 20000, unit: 'PER_SERVICE' }),
    ]);
    expect(rows.map((row) => row.key)).toEqual(['preview-0', 'preview-1', 'preview-2', 'preview-3']);
    expect(rows.map((row) => row.name)).toEqual(['Wash', 'Ironing (add-on)', 'Softener (add-on)', 'Duvet (add-on)']);
    expect(rows.map((row) => row.quantity)).toEqual([
      { kind: 'weight', value: '2.505 kg' },
      { kind: 'items', value: '3' },
      null,
      null,
    ]);
    expect(rows.map((row) => row.rateKey)).toEqual(['perKg', 'perItem', 'flat', 'flat']);
    expect(rows.map((row) => row.rateMinorUnits)).toEqual([5000, 2500, 15000, 20000]);
  });

  it('case 2: copies the server amount, even when it is not rate × quantity', () => {
    const [row] = laundryPreviewRows([
      previewLine({ amountMinorUnits: 12345, quantity: 2505, rateMinorUnits: 5000, unit: 'PER_KG' }),
    ]);
    expect(row?.amountMinorUnits).toBe(12345);
  });

  it('case 3: carries the minimum charge only when applied, with the server minimum or null', () => {
    const rows = laundryPreviewRows([
      previewLine({ minimumChargeApplied: true, minimumChargeMinorUnits: 15000 }),
      previewLine({ minimumChargeApplied: true, minimumChargeMinorUnits: null }),
      previewLine({ minimumChargeApplied: false, minimumChargeMinorUnits: 15000 }),
    ]);
    expect(rows.map((row) => row.minimumCharge)).toEqual([{ minorUnits: 15000 }, { minorUnits: null }, null]);
  });

  it('case 4: snapshot rows use the frozen description and the line id', () => {
    const line: SnapshotLine = {
      addOnId: null,
      createdAt: '2026-10-15T09:00:00.000Z',
      id: 'line-1',
      pricingSnapshot: {
        amountMinorUnits: 30000,
        description: 'Wash & fold',
        minimumChargeApplied: true,
        minimumChargeMinorUnits: 30000,
        pricingRuleId: null,
        quantity: 2505,
        rateMinorUnits: 5000,
        unit: 'PER_KG',
      },
      serviceId: 's1',
    };
    expect(laundrySnapshotRows([line])).toEqual([
      {
        amountMinorUnits: 30000,
        key: 'line-1',
        minimumCharge: { minorUnits: 30000 },
        name: 'Wash & fold',
        quantity: { kind: 'weight', value: '2.505 kg' },
        rateKey: 'perKg',
        rateMinorUnits: 5000,
      },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/laundry-price-review.test.ts`
Expected: FAIL. The import of `./laundry-price-review` cannot be resolved.

- [ ] **Step 3: Write the module**

Create `apps/web/lib/laundry-price-review.ts`:

```ts
import type { LaundryOrderQuery, PricingUnit } from '@clensy/client';
import type { LaundryOrderStatus, LaundryOrderVerb } from '@clensy/web';
import { laundryLineQuantity, type LaundryLineQuantity } from './laundry-order-page';
import { laundryRateKey, type LaundryPreviewLine, type LaundryRateKey } from './laundry-service-selection';

// What the Price section shows (#162 owner decision 5), in precedence
// order. A persisted total wins over status and role, so an order cancelled
// after pricing (§4.3 note 5) still shows its final price. Any status other
// than RECEIVED or WEIGHED without a total was never priced, and never falls
// through to the estimate. The estimate needs the `price` verb, which
// `laundryOrderActions` gives only to the operational roles on WEIGHED
// (§4.4); the status is checked as well, as in `laundryServicesView`.
export type LaundryPriceView = 'beforePricing' | 'estimate' | 'final' | 'hidden' | 'notPriced';

export interface LaundryPriceViewInput {
  // `order.totalMinorUnits !== null`, read from a finished, successful order
  // query (the page renders no order otherwise).
  hasTotal: boolean;
  // `currentAdmin.role` has loaded.
  roleResolved: boolean;
  status: LaundryOrderStatus;
  // `laundryOrderActions(status, fulfillmentType, role)`.
  verbs: readonly LaundryOrderVerb[];
}

export function laundryPriceView({ hasTotal, roleResolved, status, verbs }: LaundryPriceViewInput): LaundryPriceView {
  if (hasTotal) return 'final';
  if (status !== 'RECEIVED' && status !== 'WEIGHED') return 'notPriced';
  if (!roleResolved) return 'hidden';
  if (status === 'WEIGHED' && verbs.includes('price')) return 'estimate';
  return 'beforePricing';
}

// The Estimate card's state (#162 owner decision 3), most blocking first.
// Only the hook's `ready` makes it `ready`: that already requires a complete
// selection and a preview for the current key and newest request, with
// nothing loading and no error. A complete selection that is neither
// loading, failed nor ready cannot happen today; it shows `failed`, so Try
// again is a way out (planning decision f).
export type LaundryEstimateState = 'failed' | 'incomplete' | 'loading' | 'noBase' | 'ready';

export interface LaundryEstimateStateInput {
  // `useLaundryServiceSelection().complete`.
  complete: boolean;
  // A base service is chosen.
  hasBase: boolean;
  // `previewError !== null`.
  previewError: boolean;
  previewLoading: boolean;
  // `useLaundryServiceSelection().ready`.
  ready: boolean;
}

export function laundryEstimateState({
  complete,
  hasBase,
  previewError,
  previewLoading,
  ready,
}: LaundryEstimateStateInput): LaundryEstimateState {
  if (!hasBase) return 'noBase';
  if (!complete) return 'incomplete';
  if (previewLoading) return 'loading';
  if (previewError) return 'failed';
  return ready ? 'ready' : 'failed';
}

// One line of the breakdown, from the server only (§8.4.4: the client does
// not compute the amount). Formatting is left to the card.
export interface LaundryPriceRow {
  amountMinorUnits: number;
  key: string;
  // `null` unless the server applied a minimum charge; then the server's
  // minimum, which the type allows to be `null` (planning decision c).
  minimumCharge: { minorUnits: number | null } | null;
  name: string;
  quantity: LaundryLineQuantity;
  rateKey: LaundryRateKey;
  rateMinorUnits: number;
}

export type LaundrySnapshotLine = NonNullable<LaundryOrderQuery['laundryOrder']>['lines']['nodes'][number];

interface PricedLine {
  amountMinorUnits: number;
  description: string;
  minimumChargeApplied: boolean;
  minimumChargeMinorUnits: number | null;
  quantity: number;
  rateMinorUnits: number;
  unit: PricingUnit;
}

function priceRow(key: string, line: PricedLine): LaundryPriceRow {
  return {
    amountMinorUnits: line.amountMinorUnits,
    key,
    minimumCharge: line.minimumChargeApplied ? { minorUnits: line.minimumChargeMinorUnits } : null,
    name: line.description,
    quantity: laundryLineQuantity(line.unit, line.quantity),
    rateKey: laundryRateKey(line.unit),
    rateMinorUnits: line.rateMinorUnits,
  };
}

// Preview lines, in server order. Keyed by position: the server allows a
// repeated add-on (§8.4.3), so an id is not unique.
export function laundryPreviewRows(lines: readonly LaundryPreviewLine[]): LaundryPriceRow[] {
  return lines.map((line, index) => priceRow(`preview-${String(index)}`, line));
}

// Saved lines, by their frozen snapshot (§8.4.2), never re-read from the
// catalog.
export function laundrySnapshotRows(lines: readonly LaundrySnapshotLine[]): LaundryPriceRow[] {
  return lines.map((line) => priceRow(line.id, line.pricingSnapshot));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/laundry-price-review.test.ts`
Expected: PASS, 502 tests: the matrix (15 statuses × 2 fulfillment types × 2 total values × 8 role values = 480) plus 22 named tests (8 view, 10 estimate state, 4 rows).

- [ ] **Step 5: Key the Services view on the total (failing test)**

Planning decision (a). In `laundry-service-selection.test.ts`:

1. Delete the line `import { LAUNDRY_PRICED_STATUSES } from './laundry-order-page';`.
2. Replace the `expected` helper with:

```ts
  function expected(status: LaundryOrderStatus, role: AdminRole | undefined, hasTotal: boolean) {
    // A persisted total wins, as in Price (#162 owner decision 5.1).
    if (hasTotal) return 'locked';
    if (status === 'WEIGHED') {
      if (role === undefined) return 'hidden';
      return OPERATIONAL.has(role) ? 'editor' : 'none';
    }
    if (status === 'RECEIVED') return 'beforeWeigh';
    // No total: never priced, so never "locked because … priced".
    return 'none';
  }
```

3. In the matrix loop, rename `hasLines` to `hasTotal` in the `for`, the test name (`total ${String(hasTotal)}`), the call and the `expected` call.
4. In the literal-role test and in `'never shows the editor outside WEIGHED …'`, replace `hasLines: false` with `hasTotal: false`. In `'shows the editor for exactly …'`, rename the inner loop variable and the call's `hasLines` to `hasTotal`. Its expected set does not change: with a total, WEIGHED is `locked`, so only the no-total runs add editors.
5. Replace `'shows the locked sentence for CANCELLED and REJECTED never, with or without lines'` with:

```ts
  // #162 M5 round 1: `locked` says the order "has been priced", so it is
  // shown exactly when the order has a total, whatever the status.
  it('locks Services exactly when the order has a total', () => {
    for (const status of LAUNDRY_ORDER_STATUSES) {
      expect(laundryServicesView({ hasTotal: true, roleResolved: false, status, verbs: ['price'] })).toBe('locked');
      expect(laundryServicesView({ hasTotal: false, roleResolved: true, status, verbs: ['price'] })).not.toBe('locked');
    }
  });

  it.each(['CANCELLED', 'REJECTED', 'PRICED', 'PAID'] as const)('%s without a total shows the none sentence, not locked', (status) => {
    expect(laundryServicesView({ hasTotal: false, roleResolved: true, status, verbs: [] })).toBe('none');
  });

  // #162 M5 round 2: the unresolved role is checked before the verb, so the
  // helper keeps its own rule even if a caller passes a stale `price` verb.
  it('hides a WEIGHED order while the role loads, even with a price verb', () => {
    expect(laundryServicesView({ hasTotal: false, roleResolved: false, status: 'WEIGHED', verbs: ['price'] })).toBe('hidden');
  });
```

Run: `pnpm --filter web exec vitest run lib/laundry-service-selection.test.ts`
Expected: FAIL. Vitest does not type-check, so the tests run against the old function, which reads `hasLines` as `undefined`: every RECEIVED or WEIGHED case with a total fails on `locked`, every priced status without a total fails on `none`, and the role-loading case with a `price` verb fails on `editor`.

- [ ] **Step 6: Change `laundryServicesView`**

In `laundry-service-selection.ts`:

1. Delete `import { LAUNDRY_PRICED_STATUSES } from './laundry-order-page';`.
2. Replace the comment, type, input and function, from `// What the Services section shows (owner decision 4, #158).` through the end of `laundryServicesView`, with:

```ts
// What the Services section shows (owner decision 4, #158). A persisted
// total means the order was priced (the API writes lines and the total only
// in `priceLaundryOrder`), so it alone selects the locked sentence, as it
// selects Price's Final card (#162 planning decision a). Without a total,
// the sentence is never shown. The editor only when the actor may price
// (`laundryOrderActions` already intersects WEIGHED with the operational
// roles, spec §4.4). Nothing on a WEIGHED order until the role is known, so
// read-only copy never flashes before the editor.
export type LaundryServicesView = 'beforeWeigh' | 'editor' | 'hidden' | 'locked' | 'none';

export interface LaundryServicesViewInput {
  // `order.totalMinorUnits !== null`.
  hasTotal: boolean;
  // `currentAdmin.role` has loaded.
  roleResolved: boolean;
  status: LaundryOrderStatus;
  // `laundryOrderActions(status, fulfillmentType, role)`.
  verbs: readonly LaundryOrderVerb[];
}

export function laundryServicesView({ hasTotal, roleResolved, status, verbs }: LaundryServicesViewInput): LaundryServicesView {
  if (hasTotal) return 'locked';
  // The role is checked before the verb (#162 M5 round 2), so the editor
  // never shows while the role loads, whatever `verbs` holds.
  if (status === 'WEIGHED' && !roleResolved) return 'hidden';
  // The status is checked as well as the verb (M5 part 2): the editor can
  // never appear outside WEIGHED, even if the client verb table changes.
  if (status === 'WEIGHED' && verbs.includes('price')) return 'editor';
  if (status === 'WEIGHED') return 'none';
  if (status === 'RECEIVED') return 'beforeWeigh';
  return 'none';
}
```

`LAUNDRY_PRICED_STATUSES` stays exported from `laundry-order-page.ts`; the Weighing view (#155) still uses it, unchanged.

3. Keep `page.tsx` compiling until Task 6 replaces `ServicesBody`: in `PricingSections`, replace `hasLines: order.lines.nodes.length > 0,` with `hasTotal: order.totalMinorUnits !== null,`, and in `ServicesBody` delete `case 'lines':` and the `return <SavedLines order={order} t={t} />;` under it.

Run: `pnpm --filter web exec vitest run lib/laundry-service-selection.test.ts`
Expected: PASS. The render case `'lists the saved lines of a %s order without the locked sentence'` now fails (a cancelled order with lines and no total shows "No services selected yet."); Task 6, Step 1 replaces it. No other suite changes.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/laundry-price-review.ts apps/web/lib/laundry-price-review.test.ts apps/web/lib/laundry-service-selection.ts apps/web/lib/laundry-service-selection.test.ts 'apps/web/app/app/laundry/[id]/page.tsx'
git commit -m "feat(162): add the price view, estimate state and row helpers"
```

---

### Task 2: Selection hook: A→B→A, retry, `complete`

Implements decision 3 (retry, readiness) and the #158 M7 carry-forwards 1 and 2.

**Files:**
- Modify: `apps/web/lib/use-laundry-service-selection.ts`
- Test: `apps/web/lib/use-laundry-service-selection.hook.test.tsx`

**Interfaces:**
- Produces, added to `LaundryServiceSelectionState`:
  - `complete: boolean`: base chosen, every row chosen, every count valid. It already exists inside the hook (`use-laundry-service-selection.ts:183`, `const complete = input !== null && selection.addOns.every((row) => row.choice !== null);`) and is only exported here. `input` is `previewInputFromSelection`, the same builder that makes `priceInput`, which returns `null` for any count `parseItemCount` rejects and never reads `quantityTouched`. So the error message waits for blur, but completeness never does. There is no second definition of valid input.
  - `retryPreview: () => void`: re-requests the current key under a new generation. It is a no-op when there is no key.

- [ ] **Step 1: Record every render in the test harness**

In `use-laundry-service-selection.hook.test.tsx`, replace:

```tsx
let latest: Hook;
let props: Props;

function Probe(current: Props) {
  latest = useLaundryServiceSelection(current);
  return null;
}
```

with:

```tsx
let latest: Hook;
let props: Props;
// Every committed render's result, to catch a flicker between two checks.
// Pushed from a layout effect, which runs once per commit, so a render
// React abandons or repeats is never recorded (M5 final review, P2-2).
const renders: Hook[] = [];

function Probe(current: Props) {
  const result = useLaundryServiceSelection(current);
  latest = result;
  useLayoutEffect(() => {
    renders.push(result);
  });
  return null;
}
```

Also replace `import { act } from 'react';` with `import { act, useLayoutEffect } from 'react';`.

In `beforeEach`, after `unitKeySpy.mockClear();`, add `renders.length = 0;`.

- [ ] **Step 2: Write the failing tests**

Append inside `describe('useLaundryServiceSelection', …)`, after the last existing case:

```tsx
  // #158 M7 carry-forward 1: a return to A within one debounce, before B
  // was ever sent, keeps A's current result: no ready flicker, no request.
  it('case 20: A→B→A within one debounce keeps ready and sends nothing more', async () => {
    render();
    chooseBase();
    wait(300);
    await resolveCall(0, payload([baseLine()]));
    expect(latest.ready).toBe(true);
    chooseBase(OTHER_BASE_CHOICE);
    expect(latest.ready).toBe(false);
    expect(latest.previewLoading).toBe(true);
    wait(100);
    const mark = renders.length;
    chooseBase();
    expect(latest.ready).toBe(true);
    wait(1000);
    expect(sent()).toBe(1);
    expect(renders.slice(mark).every((result) => result.ready)).toBe(true);
    expect(latest.priceInput).toEqual(input(0));
  });

  // Planning decision f still holds: once B was sent, A is asked again.
  it('case 21: A→B→A across a sent request requests A again', async () => {
    render();
    chooseBase();
    wait(300);
    await resolveCall(0, payload([baseLine()]));
    chooseBase(OTHER_BASE_CHOICE);
    wait(300);
    expect(sent()).toBe(2);
    chooseBase();
    expect(latest.ready).toBe(false);
    wait(300);
    expect(sent()).toBe(3);
    expect(input(2)).toEqual(input(0));
    await resolveCall(2, payload([baseLine()]));
    expect(latest.ready).toBe(true);
  });

  // #158 M7 carry-forward 2 (#162 owner decision 3).
  describe('case 22: retryPreview', () => {
    it('re-sends the same input after a failure and keeps the selection', async () => {
      render();
      chooseBase();
      const row = addRow(ADD_ON_1);
      wait(300);
      await rejectCall(0, new Error('network down'));
      expect(latest.previewError).not.toBeNull();
      const selection = latest.selection;
      edit(() => latest.retryPreview());
      expect(latest.previewError).toBeNull();
      expect(latest.previewLoading).toBe(true);
      expect(latest.ready).toBe(false);
      expect(latest.selection).toBe(selection);
      wait(300);
      expect(sent()).toBe(2);
      expect(input(1)).toEqual(input(0));
      await resolveCall(1, payload([baseLine(), addOnLine(A1)]));
      expect(latest.ready).toBe(true);
      expect(latest.preview?.addOns.get(row)?.addOnId).toBe(A1);
    });

    it('a second failure shows again, and a late first response is ignored', async () => {
      render();
      chooseBase();
      wait(300);
      edit(() => latest.retryPreview());
      wait(300);
      expect(sent()).toBe(2);
      await rejectCall(1, new Error('still down'));
      await resolveCall(0, payload([baseLine()]));
      expect(latest.previewError).not.toBeNull();
      expect(latest.ready).toBe(false);
    });

    it('does nothing without a previewable selection', () => {
      render();
      const mark = renders.length;
      edit(() => latest.retryPreview());
      // A true no-op (M5 round 1): no state change, so no render.
      expect(renders.length).toBe(mark);
      wait(1000);
      expect(sent()).toBe(0);
      expect(latest.previewLoading).toBe(false);
    });
  });

  it('case 23: complete needs a base, every row chosen and every count valid', async () => {
    render();
    expect(latest.complete).toBe(false);
    await learnBasePerItem();
    expect(latest.complete).toBe(true);
    const row = addRow();
    expect(latest.complete).toBe(false);
    edit(() => latest.chooseAddOn(row, ADD_ON_1));
    expect(latest.complete).toBe(true);
    // Typed, never blurred (M5 round 1): the message waits for blur, but
    // completeness and readiness do not.
    edit(() => latest.changeBaseQuantity('0'));
    expect(latest.complete).toBe(false);
    expect(latest.ready).toBe(false);
    expect(latest.priceInput).toBeNull();
  });

  // M5 round 1: a settled failure is a settled outcome too. A→B→A within one
  // debounce keeps A's failure and sends nothing; only Try again re-sends.
  it('case 24: A fails, then A→B→A within one debounce keeps the failure and sends nothing more', async () => {
    render();
    chooseBase();
    wait(300);
    await rejectCall(0, new Error('network down'));
    expect(latest.previewError).not.toBeNull();
    chooseBase(OTHER_BASE_CHOICE);
    wait(100);
    const mark = renders.length;
    chooseBase();
    wait(1000);
    expect(sent()).toBe(1);
    // Every committed state after the return shows A's failure: no loading
    // flash, no ready.
    expect(renders.slice(mark).every((result) => result.previewError !== null && !result.previewLoading && !result.ready)).toBe(true);
    expect(latest.previewError).not.toBeNull();
    expect(latest.ready).toBe(false);
    edit(() => latest.retryPreview());
    wait(300);
    expect(sent()).toBe(2);
    expect(input(1)).toEqual(input(0));
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/use-laundry-service-selection.hook.test.tsx`
Expected: FAIL. Cases 20 and 22 fail on `ready`, `sent()` and `retryPreview is not a function`. Case 23 fails on `complete` being `undefined`. Case 24 fails on `sent()` (A is asked again today) and on `retryPreview`. Case 21 passes as a **characterization test**: it pins the existing planning decision f behavior. Cases 1–19 pass.

- [ ] **Step 4: Implement**

In `use-laundry-service-selection.ts`:

(a) In `LaundryServiceSelectionState`, after `previewLoading: boolean;`, add:

```ts
  // Base chosen, every add-on row chosen, every count valid. False whenever
  // the input cannot be built. #162 shows "Finish choosing services" for a
  // chosen base that is not complete.
  complete: boolean;
```

and after `removeAddOn: (key: number) => void;`, add:

```ts
  // Asks for the current input again, under a new request, after a failure
  // (#158 M7 carry-forward 2). The selection is untouched. Nothing happens
  // when nothing can be previewed.
  retryPreview: () => void;
```

(b) After `const latestKey = useRef<string | null>(null);`, add:

```ts
  // The key and generation of the settled outcome, readable in the timer
  // (#158 M7 carry-forward 1).
  const settledRef = useRef<{ generation: number; key: string } | null>(null);
```

and after the `settled` state, add:

```ts
  // Bumped by `retryPreview`, so the request effect runs again for an
  // unchanged key.
  const [retries, setRetries] = useState(0);
```

(c) Replace the request effect:

```ts
  useEffect(() => {
    if (key === null) return;
    const [, keyInput] = JSON.parse(key) as [number, PriceLaundryOrderInput];
    let live = true;
    const timer = setTimeout(() => {
      generation.current += 1;
```

with:

```ts
  useEffect(() => {
    if (key === null) return;
    const [, keyInput] = JSON.parse(key) as [number, PriceLaundryOrderInput];
    let live = true;
    const timer = setTimeout(() => {
      // A→B→A within one debounce (#158 M7 carry-forward 1): the newest
      // request sent was for this key, and its outcome has settled, so it
      // is still current. Asking again would only flip `ready` off and on.
      // A retry clears `settledRef` first, so it always asks.
      if (settledRef.current?.key === key && settledRef.current.generation === generation.current) return;
      generation.current += 1;
```

(d) In the same effect, replace:

```ts
        if (outcome.ok) setUnits((current) => rememberUnits(current, outcome.data.lines));
        setSettled({ ...sent, outcome });
```

with:

```ts
        if (outcome.ok) setUnits((current) => rememberUnits(current, outcome.data.lines));
        settledRef.current = sent;
        setSettled({ ...sent, outcome });
```

(e) Replace the effect's dependency list `}, [client, key]);` with `}, [client, key, retries]);`.

(f) In the returned object, after `chooseBase: …,` add `complete,`. After `removeAddOn: …,` add:

```ts
    retryPreview: () => {
      // Nothing to re-send: change no state (M5 round 1).
      if (key === null) return;
      settledRef.current = null;
      setSettled(null);
      setRetries((count) => count + 1);
    },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/use-laundry-service-selection.hook.test.tsx`
Expected: PASS. All cases pass, including the existing case 14 ("an older response arriving after a newer one changes nothing") and the `afterEach` check that only the preview query is sent.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/use-laundry-service-selection.ts apps/web/lib/use-laundry-service-selection.hook.test.tsx
git commit -m "feat(162): keep a current preview on an A-B-A return, add retry and complete"
```

---

### Task 3: Confirm hook

Implements decision 6; planning decision (e); issue Confirm behavior.

**Files:**
- Create: `apps/web/lib/use-confirm-laundry-price.ts`
- Test: `apps/web/lib/use-confirm-laundry-price.hook.test.tsx`
- Modify: `packages/web/src/i18n/messages/en/laundry.ts` (two keys)

**Interfaces:**
- Consumes: `usePriceLaundryOrderMutation`, `PriceLaundryOrderInput` (`@clensy/client`); `useToast` (`@clensy/ui`); `graphQLErrorMessage`; `LaundryServiceSelection`.
- Produces:
  - `interface LaundryPriceConfirmFailure { message: string; selection: LaundryServiceSelection }`
  - `interface ConfirmLaundryPriceState { confirm: (input: PriceLaundryOrderInput, selection: LaundryServiceSelection) => Promise<void>; confirming: boolean; failure: LaundryPriceConfirmFailure | null }`
  - `useConfirmLaundryPrice(options: { refetch: () => Promise<unknown> }): ConfirmLaundryPriceState`
  - Copy: `laundry.order.price.success` = "Price confirmed.", `laundry.order.price.failure` = "Unable to price order."

- [ ] **Step 1: Write the failing tests**

Create `apps/web/lib/use-confirm-laundry-price.hook.test.tsx`:

```tsx
// @vitest-environment jsdom
import type { PriceLaundryOrderInput } from '@clensy/client';
import { ToastProvider } from '@clensy/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_LAUNDRY_SERVICE_SELECTION, type LaundryServiceSelection } from './laundry-service-selection';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Deferred {
  options: unknown;
  reject: (error: unknown) => void;
  resolve: (value: unknown) => void;
}

const api = vi.hoisted(() => ({
  invoice: vi.fn(),
  paid: vi.fn(),
  price: vi.fn(),
  prices: [] as Deferred[],
  refetch: vi.fn(),
  refetches: [] as Deferred[],
}));

vi.mock('@clensy/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@clensy/client')>()),
  useGenerateInvoiceFromOrderMutation: () => [api.invoice, { loading: false }],
  useMarkLaundryOrderPaidMutation: () => [api.paid, { loading: false }],
  usePriceLaundryOrderMutation: () => [api.price, { loading: false }],
}));

const { useConfirmLaundryPrice } = await import('./use-confirm-laundry-price');
type Hook = ReturnType<typeof useConfirmLaundryPrice>;

const INPUT: PriceLaundryOrderInput = {
  addOns: [],
  baseServiceId: '11111111-1111-4111-8111-111111111111',
  orderId: '00000000-0000-4000-8000-000000000001',
};
const SELECTION: LaundryServiceSelection = { ...EMPTY_LAUNDRY_SERVICE_SELECTION, baseQuery: 'Wash' };
const PRICED = { data: { priceLaundryOrder: { id: INPUT.orderId } } };

let container: HTMLDivElement;
let root: Root;
let latest: Hook;

function Probe() {
  latest = useConfirmLaundryPrice({ refetch: api.refetch });
  return null;
}

function deferred(list: Deferred[]) {
  return (options?: unknown) =>
    new Promise((resolve, reject) => {
      list.push({ options, reject, resolve });
    });
}

beforeEach(() => {
  api.prices.length = 0;
  api.refetches.length = 0;
  api.price.mockReset();
  api.price.mockImplementation(deferred(api.prices));
  api.refetch.mockReset();
  api.refetch.mockImplementation(deferred(api.refetches));
  api.invoice.mockReset();
  api.paid.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  // Issue: an estimate never generates an invoice or marks an order paid.
  expect(api.invoice).not.toHaveBeenCalled();
  expect(api.paid).not.toHaveBeenCalled();
});

async function settle(list: Deferred[], index: number, how: 'reject' | 'resolve', value: unknown) {
  await act(async () => {
    list[index]![how](value);
  });
}

function serverError(message: string) {
  return { graphQLErrors: [{ extensions: { originalError: { message } }, message: 'Bad Request Exception' }] };
}

describe('useConfirmLaundryPrice', () => {
  it('case 1: sends the input unchanged, toasts, and stays confirming until the refetch settles', async () => {
    let done: Promise<void> | undefined;
    act(() => {
      done = latest.confirm(INPUT, SELECTION);
    });
    expect(api.price).toHaveBeenCalledTimes(1);
    expect(api.prices[0]!.options).toEqual({ variables: { input: INPUT } });
    expect(latest.confirming).toBe(true);
    await settle(api.prices, 0, 'resolve', PRICED);
    expect(document.body.textContent).toContain('Price confirmed.');
    expect(api.refetch).toHaveBeenCalledTimes(1);
    expect(latest.confirming).toBe(true);
    await settle(api.refetches, 0, 'resolve', undefined);
    await act(async () => {
      await done;
    });
    expect(latest.confirming).toBe(false);
    expect(latest.failure).toBeNull();
  });

  // M5 Section 2 correction 2: both calls land before React re-renders, so
  // only the synchronous ref can drop the second.
  it('case 2: a synchronous double invocation sends one request', () => {
    act(() => {
      void latest.confirm(INPUT, SELECTION);
      void latest.confirm(INPUT, SELECTION);
    });
    expect(api.price).toHaveBeenCalledTimes(1);
  });

  it('case 3: a failure keeps the server message and the selection, refetches, and releases after the refetch', async () => {
    act(() => {
      void latest.confirm(INPUT, SELECTION);
    });
    await settle(api.prices, 0, 'reject', serverError('Laundry order cannot transition from PRICED to PRICED'));
    expect(latest.failure).toEqual({ message: 'Laundry order cannot transition from PRICED to PRICED', selection: SELECTION });
    expect(latest.failure?.selection).toBe(SELECTION);
    expect(api.refetch).toHaveBeenCalledTimes(1);
    expect(latest.confirming).toBe(true);
    expect(document.body.textContent).not.toContain('Price confirmed.');
    await settle(api.refetches, 0, 'resolve', undefined);
    expect(latest.confirming).toBe(false);
    expect(latest.failure?.message).toBe('Laundry order cannot transition from PRICED to PRICED');
  });

  it.each([
    ['a network error', 'reject', new Error('network down')],
    ['a result with errors', 'resolve', { data: null, errors: [{ message: '' }] }],
    ['a result without the payload', 'resolve', { data: {} }],
  ] as const)('case 4: %s shows "Unable to price order."', async (_label, how, value) => {
    act(() => {
      void latest.confirm(INPUT, SELECTION);
    });
    await settle(api.prices, 0, how, value);
    expect(latest.failure?.message).toBe('Unable to price order.');
    await settle(api.refetches, 0, 'resolve', undefined);
    expect(latest.confirming).toBe(false);
  });

  it('case 5: a failed refetch after success is swallowed and releases the guard', async () => {
    act(() => {
      void latest.confirm(INPUT, SELECTION);
    });
    await settle(api.prices, 0, 'resolve', PRICED);
    await settle(api.refetches, 0, 'reject', new Error('reload failed'));
    expect(latest.confirming).toBe(false);
    expect(latest.failure).toBeNull();
  });

  it('case 6: a failed refetch after a failure keeps the mutation error', async () => {
    act(() => {
      void latest.confirm(INPUT, SELECTION);
    });
    await settle(api.prices, 0, 'reject', serverError('Order is cancelled'));
    await settle(api.refetches, 0, 'reject', new Error('reload failed'));
    expect(latest.confirming).toBe(false);
    expect(latest.failure?.message).toBe('Order is cancelled');
  });

  it('case 7: Confirm again clears the old failure at once and sends again', async () => {
    act(() => {
      void latest.confirm(INPUT, SELECTION);
    });
    await settle(api.prices, 0, 'reject', new Error('network down'));
    await settle(api.refetches, 0, 'resolve', undefined);
    act(() => {
      void latest.confirm(INPUT, SELECTION);
    });
    expect(latest.failure).toBeNull();
    expect(api.price).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/use-confirm-laundry-price.hook.test.tsx`
Expected: FAIL. `./use-confirm-laundry-price` cannot be resolved.

- [ ] **Step 3: Add the two copy keys**

In `packages/web/src/i18n/messages/en/laundry.ts`, replace:

```ts
    price: {
      notPriced: 'Not priced yet.',
      total: 'Order total',
    },
```

with:

```ts
    price: {
      failure: 'Unable to price order.',
      notPriced: 'Not priced yet.',
      success: 'Price confirmed.',
      total: 'Order total',
    },
```

- [ ] **Step 4: Write the hook**

Create `apps/web/lib/use-confirm-laundry-price.ts`:

```ts
'use client';
import { usePriceLaundryOrderMutation, type PriceLaundryOrderInput } from '@clensy/client';
import { useToast } from '@clensy/ui';
import { useClensyTranslations } from '@clensy/web';
import { useRef, useState } from 'react';
import { graphQLErrorMessage } from './graphql-error-message';
import type { LaundryServiceSelection } from './laundry-service-selection';

export interface LaundryPriceConfirmFailure {
  message: string;
  // The selection Confirm was pressed with. The page shows the alert only
  // while the selection is this same object: any edit or touch replaces it,
  // which clears the alert (#162 owner decision 6.5; planning decision e).
  selection: LaundryServiceSelection;
}

export interface ConfirmLaundryPriceState {
  confirm: (input: PriceLaundryOrderInput, selection: LaundryServiceSelection) => Promise<void>;
  // True through the mutation and the refetch that follows it. The page
  // disables both editors meanwhile (owner decision 6.3).
  confirming: boolean;
  failure: LaundryPriceConfirmFailure | null;
}

export interface UseConfirmLaundryPriceOptions {
  // Reloads the order. On success the status becomes PRICED; on failure it
  // shows whatever the order now is (owner decision 6.5).
  refetch: () => Promise<unknown>;
}

// `priceLaundryOrder`, once per Confirm (§8.4.4). The input is the previewed
// one, unchanged (owner decision 6.1). It never calls an invoice or payment
// mutation (issue Confirm behavior).
export function useConfirmLaundryPrice({ refetch }: UseConfirmLaundryPriceOptions): ConfirmLaundryPriceState {
  const t = useClensyTranslations('laundry');
  const toast = useToast();
  const [price] = usePriceLaundryOrderMutation();
  // Taken synchronously, so a second Confirm that lands before React
  // re-renders (and disables the button) is dropped (owner decision 6.2).
  const inFlight = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<LaundryPriceConfirmFailure | null>(null);

  async function confirm(input: PriceLaundryOrderInput, selection: LaundryServiceSelection) {
    if (inFlight.current) return;
    inFlight.current = true;
    setConfirming(true);
    setFailure(null);
    try {
      // As in the weighing editor (#155): Apollo's default `errorPolicy`
      // rejects on GraphQL errors, and a resolved result with errors or
      // without the order still counts as a failure.
      let failed: string | undefined;
      try {
        const result = await price({ variables: { input } });
        if ((result.errors?.length ?? 0) > 0 || !result.data?.priceLaundryOrder) {
          failed = graphQLErrorMessage({ graphQLErrors: result.errors }) ?? t('order.price.failure');
        }
      } catch (error) {
        failed = graphQLErrorMessage(error) ?? t('order.price.failure');
      }
      if (failed === undefined) toast.success(t('order.price.success'));
      else setFailure({ message: failed, selection });
      try {
        await refetch();
      } catch {
        // Apollo puts the order query in error, and the page shows its order
        // error state. Nothing here assumes the order is still priceable.
      }
    } finally {
      inFlight.current = false;
      setConfirming(false);
    }
  }

  return { confirm, confirming, failure };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/use-confirm-laundry-price.hook.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/use-confirm-laundry-price.ts apps/web/lib/use-confirm-laundry-price.hook.test.tsx packages/web/src/i18n/messages/en/laundry.ts
git commit -m "feat(162): add the confirm-price hook with a synchronous guard"
```

---

### Task 4: Price card

Implements decisions 1, 3; planning decisions (b), (c), (d); issue Layout, Acceptance.

**Files:**
- Create: `apps/web/components/laundry/laundry-price-card.tsx`
- Test: `apps/web/lib/laundry-price-card.render.test.tsx`
- Modify: `packages/web/src/i18n/messages/en/laundry.ts`

**Interfaces:**
- Consumes: `LaundryPriceRow`, `LaundryEstimateState` (Task 1); `formatMinorUnits`; `Button` (`@clensy/ui`).
- Produces:

```ts
export type LaundryPriceCardProps =
  | { kind: 'final'; more: boolean; rows: readonly LaundryPriceRow[]; totalMinorUnits: number }
  | {
      kind: 'estimate';
      confirming: boolean;
      // The confirm failure to show, already filtered to the current selection.
      failure: string | undefined;
      onConfirm: () => void;
      onRetry: () => void;
      // Shown only in the `ready` state.
      rows: readonly LaundryPriceRow[];
      state: LaundryEstimateState;
      totalMinorUnits: number | null;
    };
export function LaundryPriceCard(props: LaundryPriceCardProps): JSX.Element;
```

- [ ] **Step 1: Write the failing tests**

Create `apps/web/lib/laundry-price-card.render.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LaundryPriceCard, type LaundryPriceCardProps } from '../components/laundry/laundry-price-card';
import type { LaundryEstimateState, LaundryPriceRow } from './laundry-price-review';

const ROWS: LaundryPriceRow[] = [
  {
    amountMinorUnits: 12345,
    key: 'preview-0',
    minimumCharge: { minorUnits: 15000 },
    name: 'Wash & fold with a very long name that has to wrap on a phone',
    quantity: { kind: 'weight', value: '2.505 kg' },
    rateKey: 'perKg',
    rateMinorUnits: 5000,
  },
  {
    amountMinorUnits: 7500,
    key: 'preview-1',
    minimumCharge: null,
    name: 'Ironing (add-on)',
    quantity: { kind: 'items', value: '3' },
    rateKey: 'perItem',
    rateMinorUnits: 2500,
  },
  {
    amountMinorUnits: 2500,
    key: 'preview-2',
    minimumCharge: { minorUnits: null },
    name: 'Shoes',
    quantity: { kind: 'items', value: '1' },
    rateKey: 'perItem',
    rateMinorUnits: 2500,
  },
  {
    amountMinorUnits: 15000,
    key: 'preview-3',
    minimumCharge: null,
    name: 'Softener (add-on)',
    quantity: null,
    rateKey: 'flat',
    rateMinorUnits: 15000,
  },
];

function estimate(change: Partial<Extract<LaundryPriceCardProps, { kind: 'estimate' }>> = {}): string {
  return renderToStaticMarkup(
    <LaundryPriceCard
      kind="estimate"
      confirming={false}
      failure={undefined}
      onConfirm={() => {}}
      onRetry={() => {}}
      rows={ROWS}
      state="ready"
      totalMinorUnits={99999}
      {...change}
    />,
  );
}

function final(change: Partial<Extract<LaundryPriceCardProps, { kind: 'final' }>> = {}): string {
  return renderToStaticMarkup(<LaundryPriceCard kind="final" more={false} rows={ROWS} totalMinorUnits={45000} {...change} />);
}

function confirmTag(html: string): string {
  const tag = /<button\b[^>]*>(Confirm price|Confirming…)<\/button>/.exec(html)?.[0];
  expect(tag).toBeDefined();
  return tag!;
}

const CAPTION =
  'Confirming sets the final price. Weight, services, and total cannot be changed afterward. To correct a mistake before payment, cancel the order and start a new one.';

describe('LaundryPriceCard', () => {
  it('case 1: an estimate says Estimate, never Final price, Total due or Invoice', () => {
    const html = estimate();
    expect(html).toContain('<div class="rounded-md border border-slate-200 p-4">');
    expect(html).toMatch(/<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Estimate<\/p>/);
    expect(html).not.toContain('Final price');
    expect(html).not.toContain('Total due');
    expect(html).not.toContain('Invoice');
  });

  it('case 2: a ready estimate lists every server figure and enables Confirm', () => {
    const html = estimate();
    expect(html).toContain('Wash &amp; fold with a very long name');
    expect(html).toContain('2.505 kg');
    expect(html).toContain('₱50.00 per kg');
    expect(html).toContain('₱123.45');
    expect(html).toContain('3 items');
    expect(html).toContain('1 item<');
    expect(html).not.toContain('1 items');
    expect(html).toContain('₱25.00 per item');
    expect(html).toContain('₱150.00 flat');
    expect(html).toContain('Estimated total');
    expect(html).toMatch(/<p class="[^"]*text-lg font-semibold[^"]*">₱999\.99<\/p>/);
    expect(confirmTag(html)).not.toContain('disabled');
    expect(html).toContain(CAPTION);
  });

  it.each<[LaundryEstimateState, string]>([
    ['noBase', 'Select a base service to see an estimate.'],
    ['incomplete', 'Finish choosing services to see an estimate.'],
    ['loading', 'Updating estimate…'],
    ['failed', 'Couldn’t calculate the estimate.'],
  ])('case 3: %s shows its sentence, no rows or total, a disabled Confirm and the caption', (state, sentence) => {
    const html = estimate({ state });
    expect(html).toContain('>Estimate<');
    expect(html).toMatch(new RegExp(`<div aria-live="polite"><p[^>]*>${sentence}</p></div>`));
    for (const absent of ['Wash &amp; fold', '₱123.45', '₱50.00 per kg', 'Estimated total', '₱999.99']) {
      expect(html).not.toContain(absent);
    }
    expect(confirmTag(html)).toContain('disabled');
    expect(html).toContain(CAPTION);
    expect(html.includes('>Try again</button>')).toBe(state === 'failed');
  });

  it('case 4: confirming says Confirming… and is disabled; a failure is an alert', () => {
    const html = estimate({ confirming: true, failure: 'Unable to price order.' });
    expect(confirmTag(html)).toContain('Confirming…');
    expect(confirmTag(html)).toContain('disabled');
    expect(html).toMatch(/<p role="alert"[^>]*>Unable to price order\.<\/p>/);
    expect(estimate()).not.toContain('role="alert"');
  });

  it('case 5: minimum-charge notes use the server minimum, or none when it is null', () => {
    const html = estimate();
    expect(html).toContain('Minimum charge applied (₱150.00).');
    expect(html).toContain('Minimum charge applied.');
    expect(html.split('Minimum charge applied').length - 1).toBe(2);
  });

  it('case 6: a final card reads Final price, the order total, no Confirm and no estimate wording', () => {
    const html = final();
    expect(html).toMatch(/>Final price<\/p>/);
    expect(html).not.toContain('Estimate');
    expect(html).not.toContain('Confirm price');
    expect(html).not.toContain('<button');
    expect(html).not.toContain(CAPTION);
    expect(html).toContain('Order total');
    expect(html).toContain('₱450.00');
    expect(html).toContain('Minimum charge applied (₱150.00).');
    expect(html).not.toContain('More lines are not loaded.');
    expect(final({ more: true })).toContain('More lines are not loaded.');
    const empty = final({ rows: [] });
    expect(empty).not.toContain('<li');
    expect(empty).toContain('₱450.00');
  });

  it('case 7: rows are a two-column grid that wraps the name, with tabular figures', () => {
    const html = final();
    expect(html.split('class="grid grid-cols-[minmax(0,1fr)_auto] gap-2"').length - 1).toBe(4);
    expect(html).toContain('<div class="min-w-0">');
    expect(html).toContain('tabular-nums');
    expect(html).not.toContain('<table');
  });

  // M5 round 1: an inconsistent `ready` with no server total is never a
  // blank estimate and never shows rows or an invented total.
  it('case 8: ready without a total shows the failed state, no rows, and a disabled Confirm', () => {
    const html = estimate({ state: 'ready', totalMinorUnits: null });
    expect(html).toContain('Couldn’t calculate the estimate.');
    expect(html).toContain('>Try again</button>');
    for (const absent of ['Wash &amp; fold', '₱123.45', 'Estimated total', '₱999.99']) {
      expect(html).not.toContain(absent);
    }
    expect(confirmTag(html)).toContain('disabled');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/laundry-price-card.render.test.tsx`
Expected: FAIL. `../components/laundry/laundry-price-card` cannot be resolved.

- [ ] **Step 3: Add the card copy**

In `packages/web/src/i18n/messages/en/laundry.ts`, replace the `price` block from Task 3 with:

```ts
    price: {
      beforePricing: 'Price is available after the order is weighed and services are chosen.',
      caption:
        'Confirming sets the final price. Weight, services, and total cannot be changed afterward. To correct a mistake before payment, cancel the order and start a new one.',
      confirm: 'Confirm price',
      confirming: 'Confirming…',
      estimate: 'Estimate',
      estimatedTotal: 'Estimated total',
      failed: 'Couldn’t calculate the estimate.',
      failure: 'Unable to price order.',
      final: 'Final price',
      incomplete: 'Finish choosing services to see an estimate.',
      items: '{n} items',
      itemsOne: '1 item',
      loading: 'Updating estimate…',
      minimumApplied: 'Minimum charge applied.',
      minimumAppliedAmount: 'Minimum charge applied ({amount}).',
      more: 'More lines are not loaded.',
      noBase: 'Select a base service to see an estimate.',
      notPriced: 'Not priced yet.',
      rate: {
        flat: '{price} flat',
        perItem: '{price} per item',
        perKg: '{price} per kg',
      },
      retry: 'Try again',
      success: 'Price confirmed.',
      total: 'Order total',
    },
```

(`notPriced` changes value in Task 6, together with the page test that asserts it.)

- [ ] **Step 4: Write the card**

Create `apps/web/components/laundry/laundry-price-card.tsx`:

```tsx
'use client';

import { Button } from '@clensy/ui';
import { useClensyTranslations } from '@clensy/web';
import { formatMinorUnits } from '../../lib/format-price';
import type { LaundryEstimateState, LaundryPriceRow } from '../../lib/laundry-price-review';

type Translate = (key: string) => string;

const CAPTION_ID = 'laundry-price-caption';

export type LaundryPriceCardProps =
  | { kind: 'final'; more: boolean; rows: readonly LaundryPriceRow[]; totalMinorUnits: number }
  | {
      kind: 'estimate';
      confirming: boolean;
      // The confirm failure to show, already limited to the current
      // selection by the page (planning decision e).
      failure: string | undefined;
      onConfirm: () => void;
      onRetry: () => void;
      // Shown only in the `ready` state (owner decision 3).
      rows: readonly LaundryPriceRow[];
      state: LaundryEstimateState;
      totalMinorUnits: number | null;
    };

// The Price section's card (#162). An estimate is built from the current
// preview, a final price from the frozen snapshot (§8.4.4). Every figure is
// the server's; this only formats (owner decision 1).
export function LaundryPriceCard(props: LaundryPriceCardProps) {
  const t = useClensyTranslations('laundry');
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {t(props.kind === 'final' ? 'order.price.final' : 'order.price.estimate')}
      </p>
      {props.kind === 'final' ? (
        <>
          <Rows rows={props.rows} t={t} />
          {props.more ? <p className="mt-3 text-slate-600">{t('order.price.more')}</p> : null}
          <Footer label={t('order.price.total')} totalMinorUnits={props.totalMinorUnits} />
        </>
      ) : (
        <EstimateBody {...props} t={t} />
      )}
    </div>
  );
}

const STATE_SENTENCE: Partial<Record<LaundryEstimateState, string>> = {
  failed: 'order.price.failed',
  incomplete: 'order.price.incomplete',
  loading: 'order.price.loading',
  noBase: 'order.price.noBase',
};

function EstimateBody({
  confirming,
  failure,
  onConfirm,
  onRetry,
  rows,
  state,
  t,
  totalMinorUnits,
}: Extract<LaundryPriceCardProps, { kind: 'estimate' }> & { t: Translate }) {
  // `ready` without a server total is inconsistent (M5 round 1). It shows as
  // `failed`, with Try again, never as a blank estimate and never with an
  // invented total.
  const shown: LaundryEstimateState = state === 'ready' && totalMinorUnits === null ? 'failed' : state;
  const sentence = STATE_SENTENCE[shown];
  const ready = shown === 'ready' && totalMinorUnits !== null;
  return (
    <>
      <div aria-live="polite">{sentence ? <p className="mt-3 text-slate-600">{t(sentence)}</p> : null}</div>
      {shown === 'failed' ? (
        <Button type="button" variant="secondary" className="mt-2" onClick={onRetry}>
          {t('order.price.retry')}
        </Button>
      ) : null}
      {ready ? (
        <>
          <Rows rows={rows} t={t} />
          <Footer label={t('order.price.estimatedTotal')} totalMinorUnits={totalMinorUnits} />
        </>
      ) : null}
      {failure ? (
        <p role="alert" className="mt-3 text-red-600">
          {failure}
        </p>
      ) : null}
      <Button
        type="button"
        className="mt-4 w-full sm:w-auto"
        disabled={!ready || confirming}
        aria-describedby={CAPTION_ID}
        onClick={onConfirm}
      >
        {t(confirming ? 'order.price.confirming' : 'order.price.confirm')}
      </Button>
      <p id={CAPTION_ID} className="mt-2 text-slate-600">
        {t('order.price.caption')}
      </p>
    </>
  );
}

function Rows({ rows, t }: { rows: readonly LaundryPriceRow[]; t: Translate }) {
  if (rows.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{row.name}</p>
            {row.quantity ? <p className="text-slate-600 tabular-nums">{quantityText(row.quantity, t)}</p> : null}
            <p className="text-slate-600 tabular-nums">
              {t(`order.price.rate.${row.rateKey}`).replace('{price}', formatMinorUnits(row.rateMinorUnits))}
            </p>
          </div>
          <p className="text-right font-medium text-slate-900 tabular-nums">{formatMinorUnits(row.amountMinorUnits)}</p>
          {row.minimumCharge ? (
            <p className="col-span-2 text-slate-600">
              {row.minimumCharge.minorUnits === null
                ? t('order.price.minimumApplied')
                : t('order.price.minimumAppliedAmount').replace('{amount}', formatMinorUnits(row.minimumCharge.minorUnits))}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function quantityText(quantity: NonNullable<LaundryPriceRow['quantity']>, t: Translate): string {
  if (quantity.kind === 'weight') return quantity.value;
  return quantity.value === '1' ? t('order.price.itemsOne') : t('order.price.items').replace('{n}', quantity.value);
}

function Footer({ label, totalMinorUnits }: { label: string; totalMinorUnits: number }) {
  return (
    <div className="mt-4 flex items-baseline justify-between gap-2 border-t border-slate-200 pt-3">
      <p className="text-slate-700">{label}</p>
      <p className="text-lg font-semibold text-slate-900 tabular-nums">{formatMinorUnits(totalMinorUnits)}</p>
    </div>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/laundry-price-card.render.test.tsx`
Expected: PASS (11 tests). `Button` (`@clensy/ui`) renders a plain `<button>` with its text as the only child, so the button regexes match on text and `disabled=""`, not on classes.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/laundry/laundry-price-card.tsx apps/web/lib/laundry-price-card.render.test.tsx packages/web/src/i18n/messages/en/laundry.ts
git commit -m "feat(162): add the estimate and final price card"
```

---

### Task 5: Editors: selection only, and `disabled`

Implements decisions 2 and 6.3.

**Files:**
- Modify: `apps/web/components/laundry/laundry-services-editor.tsx`
- Modify: `apps/web/components/laundry/laundry-weighing-editor.tsx`
- Modify: `packages/web/src/i18n/messages/en/laundry.ts`
- Test: `apps/web/lib/laundry-services-editor.interaction.test.tsx`
- Test: `apps/web/lib/laundry-weighing-editor.interaction.test.tsx`

**Interfaces:**
- Produces:
  - `LaundryServicesEditorProps.disabled?: boolean`: disables every picker, count input and button.
  - `LaundryWeighingEditorProps.disabled?: boolean`: disables every input and button, and drops a submit.

- [ ] **Step 1: Update the services editor tests (failing)**

In `laundry-services-editor.interaction.test.tsx`:

1. Give the harness a `disabled` prop. Replace:

```tsx
function Harness({ weightGrams }: { weightGrams: number | null }) {
  const state = useLaundryServiceSelection({ enabled: true, orderId: ORDER, weightGrams });
  return (
    <div>
      <LaundryServicesEditor state={state} />
```

with:

```tsx
function Harness({ disabled = false, weightGrams }: { disabled?: boolean; weightGrams: number | null }) {
  const state = useLaundryServiceSelection({ enabled: true, orderId: ORDER, weightGrams });
  return (
    <div>
      <LaundryServicesEditor disabled={disabled} state={state} />
```

and replace `function mount(weightGrams: number | null = WEIGHT) {` and its body with:

```tsx
function mount(weightGrams: number | null = WEIGHT, disabled = false) {
  act(() => root.render(<Harness disabled={disabled} weightGrams={weightGrams} />));
}
```

2. **Case 1:** rename it to `'case 1: lays out with the base search, no form or submit, and no preview note'`, and replace `expect(text()).toContain('This is a preview. The price is final only after you confirm it.');` with `expect(text()).not.toContain('This is a preview.');`.
3. **Case 3:** rename it to `'case 3: PER_KG shows no count input, and no unit, weight or rate'`. Replace its body after `await chooseBase(WASH);` with:

```tsx
    expect(text()).not.toContain('Priced by weight');
    expect(text()).not.toContain('2.505 kg');
    expect(container.querySelector('input[inputmode="numeric"]')).toBeNull();
    expect(labelTexts()).not.toContain('Number of items');
    expect(rates()).toEqual([]);
```

4. **Case 4:** rename it to `'case 4: PER_ITEM shows a numeric count input holding 1, and no rate'`. Replace `expect(rates()).toEqual(['₱25.00 per item']);` with `expect(rates()).toEqual([]);`.
5. **Case 5:** make it a single case. Replace the whole `it.each([...])('case 5: …')` with:

```tsx
  it.each([[DRY], [DUVET]])('case 5: %s shows no count input and no flat price or rate', async (id) => {
    mount();
    await chooseBase(id);
    expect(text()).not.toContain('Flat price');
    expect(rates()).toEqual([]);
    expect(container.querySelector('input[inputmode="numeric"]')).toBeNull();
  });
```

6. **Case 6:** replace `expect(rowOf(second).textContent).toContain('Flat price');` with `expect(rowOf(second).textContent).not.toContain('Flat price');`.
7. **Case 7, first test:** rename it to `'"%s" shows the error after blur and keeps the count input'`. Delete its three `rates()` lines.
8. **Case 7, recovery test:** delete `preview.rate = 3700;`, `expect(rates()).toEqual([]);` and `expect(rates()).toEqual(['₱37.00 per item']);`. Keep the call-count and `baseQuantity` assertions.
9. **Case 8:** rename it to `'case 8: after a failed preview of a PER_ITEM base, the count input stays'`. Delete both `rates()` lines.
10. **Case 11:** in the two "follows the current choice" tests, delete the final `expect(rates()).toEqual([...]);` line.
11. **Case 17:** replace the whole test with:

```tsx
  // #162 owner decision 2: the Price card owns every rate, unit and amount.
  it('case 17: shows no rate, unit, amount or preview note', async () => {
    mount();
    await chooseBase(WASH);
    await addRow(IRON);
    await addRow(SOFT);
    expect(rates()).toEqual([]);
    expect(text()).not.toContain('₱');
    expect(text()).not.toContain('Priced by weight');
    expect(text()).not.toContain('Flat price');
    expect(text()).not.toContain('This is a preview.');
  });
```

12. Append a new case after case 19:

```tsx
  // #162 owner decision 6.3: frozen while a price is confirmed.
  it('case 20: disabled disables every search, count input and button', async () => {
    mount();
    await chooseBase(SHOES);
    await addRow(IRON);
    mount(WEIGHT, true);
    // Named one by one (M5 round 1), so a control the combobox renders
    // differently cannot hide behind a count.
    const named: (HTMLInputElement | HTMLButtonElement)[] = [
      baseInput(),
      el<HTMLInputElement>('#laundry-base-count'),
      addOnInputs()[0]!,
      countInput(rowOf(addOnInputs()[0]!))!,
      button('Add add-on'),
      button('Remove add-on 1'),
    ];
    for (const control of named) expect(control.disabled, control.id || control.textContent).toBe(true);
    // And nothing in the editor is left enabled.
    expect([...container.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button')].filter((control) => !control.disabled)).toEqual([]);
    mount(WEIGHT, false);
    expect(baseInput().disabled).toBe(false);
  });

  it('case 21: while disabled, Add add-on and Remove change no rows', async () => {
    mount();
    await chooseBase(SHOES);
    await addRow(IRON);
    mount(WEIGHT, true);
    const before = addOnInputs().map((input) => input.value);
    click('Add add-on');
    click('Remove add-on 1');
    await settle();
    expect(addOnInputs().map((input) => input.value)).toEqual(before);
    expect(addOnInputs()).toHaveLength(1);
  });
```

- [ ] **Step 2: Add the weighing editor test (failing)**

In `laundry-weighing-editor.interaction.test.tsx`, replace the `mount` function with:

```tsx
async function mount(weightGrams: number | null, disabled = false) {
  const { LaundryWeighingEditor } = await import('../components/laundry/laundry-weighing-editor');
  act(() =>
    root.render(
      <ToastProvider>
        <LaundryWeighingEditor disabled={disabled} onRecorded={onRecorded} orderId={ORDER_ID} weightGrams={weightGrams} />
      </ToastProvider>,
    ),
  );
}
```

and append inside `describe('laundry weighing editor', …)`:

```tsx
  // #162 owner decision 6.3: frozen while a price is confirmed.
  it('disables every input and button, and drops a submit, while disabled', async () => {
    await mount(2500, true);
    const controls = [...container.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button')];
    expect(controls.length).toBeGreaterThanOrEqual(3);
    expect(controls.every((control) => control.disabled)).toBe(true);
    // The handler calls preventDefault() before the guard, so the dropped
    // submit is also cancelled (M5 round 1).
    let notCancelled = true;
    act(() => {
      notCancelled = container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(notCancelled).toBe(false);
    expect(weigh.calls).toEqual([]);
    await mount(2500, false);
    expect(button('Record weight').disabled).toBe(false);
  });
```

- [ ] **Step 3: Run the editor tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/laundry-services-editor.interaction.test.tsx lib/laundry-weighing-editor.interaction.test.tsx`
Expected: FAIL.
- The services cases 1, 3, 4, 5, 6 and 17 fail on the text that is still shown.
- Services cases 20 and 21 fail: the controls are enabled, and the clicks add and remove rows.
- The weighing case fails on enabled controls.

The other cases pass.

- [ ] **Step 4: Implement the services editor**

In `laundry-services-editor.tsx`:

1. Replace the imports block from `import type { PricingUnit } from '@clensy/client';` through `import type { LaundryServiceSelectionState } …;` with:

```tsx
import type { PricingUnit } from '@clensy/client';
import { Button, FormField } from '@clensy/ui';
import { LaundrySearchCombobox, useClensyTranslations } from '@clensy/web';
import { useEffect, useRef, useState } from 'react';
import {
  laundryRowDuplicate,
  laundryUnitKey,
  parseItemCount,
  type LaundryAddOnRow,
  type LaundryCatalogChoice,
} from '../../lib/laundry-service-selection';
import { useLaundryAddOnSearch, useLaundryServiceSearch } from '../../lib/use-laundry-catalog-search';
import type { LaundryServiceSelectionState } from '../../lib/use-laundry-service-selection';
```

2. Replace the props interface and the component's doc comment and signature:

```tsx
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
```

with:

```tsx
export interface LaundryServicesEditorProps {
  // Every control is disabled while a price is confirmed (#162 owner
  // decision 6.3).
  disabled?: boolean;
  // From `useLaundryServiceSelection`, owned by the page (#158).
  state: LaundryServiceSelectionState;
}

// Base service and add-ons for a WEIGHED order (lifecycle spec §8.4.4,
// #158). It chooses services and takes counts only: the count input shows
// for a remembered PER_ITEM unit, and the Price card shows every unit, rate
// and amount (#162 owner decision 2). It never prices and computes no amount.
export function LaundryServicesEditor({ disabled = false, state }: LaundryServicesEditorProps) {
  const t = useClensyTranslations('laundry');
  const { previewError, selection, units } = state;
```

3. In the base block, add `disabled={disabled}` to the base `<CatalogPicker`. In the base `<LineDetail`, delete `line={preview?.base ?? null}` and add `disabled={disabled}`.
4. In the add-on map, replace `line={preview?.addOns.get(row.key) ?? null}` with `disabled={disabled}`.
5. On the "Add add-on" `<Button`, add `disabled={disabled}`.
6. Delete `<p className="text-slate-600">{t('order.services.note')}</p>`.
7. In `AddOnRowEditor`:
   - replace the `line: LaundryPreviewLine | null;` prop and its destructured `line,` with `disabled: boolean;` and `disabled,`;
   - add `disabled={disabled}` to its `<CatalogPicker`;
   - in its `<LineDetail`, replace `line={line}` with `disabled={disabled}`;
   - add `disabled={disabled}` to its remove `<Button`.
8. Replace the whole `LineDetail` function, and its doc comment, with:

```tsx
// The count input for a remembered PER_ITEM unit (owner decision 6). The
// unit display and the rate are in the Price card (#162 owner decision 2).
function LineDetail({
  count,
  countId,
  countTouched,
  disabled,
  onCountBlur,
  onCountChange,
  rememberedUnit,
  t,
}: {
  count: string;
  countId: string;
  countTouched: boolean;
  disabled: boolean;
  onCountBlur: () => void;
  onCountChange: (text: string) => void;
  rememberedUnit: PricingUnit | undefined;
  t: Translate;
}) {
  if (rememberedUnit !== 'PER_ITEM') return null;
  const countError = countTouched && parseItemCount(count) === null ? t('order.services.error.count') : undefined;
  return (
    <div className="flex flex-col gap-2 sm:w-56">
      <FormField
        label={t('order.services.count')}
        name={countId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={count}
        error={countError}
        disabled={disabled}
        onChange={(event) => onCountChange(event.currentTarget.value)}
        onBlur={onCountBlur}
      />
    </div>
  );
}
```

9. In `CatalogPicker`, add `disabled: boolean;` to its props type and `disabled,` to its destructuring, and pass `disabled={disabled}` to `<LaundrySearchCombobox`.

- [ ] **Step 5: Implement the weighing editor**

In `laundry-weighing-editor.tsx`:

1. In `LaundryWeighingEditorProps`, before `onRecorded`, add:

```ts
  // Every control is disabled, and a submit is dropped, while a price is
  // confirmed (#162 owner decision 6.3).
  disabled?: boolean;
```

2. Change the signature to `export function LaundryWeighingEditor({ disabled = false, onRecorded, orderId, weightGrams }: LaundryWeighingEditorProps) {`.
3. After `const summary = summarizeWeightEntries(…);`, add:

```ts
  // A save in flight or a price being confirmed (#162).
  const locked = pending || disabled;
```

4. In `handleSubmit`, replace `if (inFlight.current) return;` with `if (inFlight.current || disabled) return;`. Keep `event.preventDefault();` as the handler's first line (it is today, `laundry-weighing-editor.tsx:114`), so a dropped submit is still cancelled.
5. In the JSX, replace every `disabled={pending}` (the entry `FormField`, the remove `Button`, the "Add bag" `Button`, and the submit `Button`) with `disabled={locked}`. The focus-return effect keeps watching `pending` only.

- [ ] **Step 6: Remove the editor-only copy**

Run: `grep -rn "order.services.byWeight\|order.services.flat\|order.services.note\|order.services.rate\|services\.rate\.\|laundryRateKey" apps packages --include=*.ts --include=*.tsx | grep -v node_modules`
Expected: no use of the copy keys outside `laundry.ts`. `laundryRateKey` is used only in `laundry-service-selection.ts`, its unit test, and `laundry-price-review.ts`.

In `packages/web/src/i18n/messages/en/laundry.ts`, inside `services`, delete `byWeight`, `flat`, `note` and the `rate` block.

- [ ] **Step 7: Run the editor tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/laundry-services-editor.interaction.test.tsx lib/laundry-weighing-editor.interaction.test.tsx lib/use-laundry-service-selection.hook.test.tsx lib/laundry-service-selection.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/laundry/laundry-services-editor.tsx apps/web/components/laundry/laundry-weighing-editor.tsx packages/web/src/i18n/messages/en/laundry.ts apps/web/lib/laundry-services-editor.interaction.test.tsx apps/web/lib/laundry-weighing-editor.interaction.test.tsx
git commit -m "feat(162): leave prices to the Price card and let both editors be disabled"
```

---

### Task 6: Order page wiring

Implements decisions 1, 4, 5, 6; planning decisions (a), (e), (g); issue Layout, Confirm behavior, Acceptance, Tests.

**Files:**
- Modify: `apps/web/app/app/laundry/[id]/page.tsx`
- Modify: `packages/web/src/i18n/messages/en/laundry.ts`
- Test: `apps/web/lib/laundry-order-page.render.test.tsx`
- Create: `apps/web/lib/laundry-order-page.interaction.test.tsx`

**Interfaces:**
- Consumes everything from Tasks 1–5.

- [ ] **Step 1: Update the render tests (failing)**

In `laundry-order-page.render.test.tsx`:

1. **The mutation mock records calls of the mutate function**, not of the hook, because the page now calls the hook on every render. Replace:

```tsx
  usePriceLaundryOrderMutation: (...args: unknown[]) => {
    page.priceMutationCalls.push(args);
    return [() => Promise.resolve({ data: {} }), { loading: false }];
  },
```

with:

```tsx
  usePriceLaundryOrderMutation: () => [
    (...args: unknown[]) => {
      page.priceMutationCalls.push(args);
      return Promise.resolve({ data: {} });
    },
    { loading: false },
  ],
```

2. **Narrow the controls test (issue Tests).** Replace the test `'renders the header, back link and no list, drawer or controls'` with the version below. Its first ten assertions are unchanged; only the controls check is narrowed:

```tsx
  it('renders the header, back link, no list or drawer, and no controls in the read-only sections', async () => {
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
    // Weighing, Services and Price may hold controls (#155, #158, #162).
    // Everything before the first section, and Overview, Invoice and
    // Actions, stay read-only.
    const header = html.slice(0, html.indexOf('<section'));
    for (const part of [header, section(html, 'overview'), section(html, 'invoice'), section(html, 'actions')]) {
      expect(part).not.toContain('<button');
      expect(part).not.toContain('<form');
      expect(part).not.toContain('<input');
    }
  });
```

3. In `'shows em dashes and no line list for a received order'`, replace `expect(section(html, 'price')).toContain('Not priced yet.');` with:

```tsx
    expect(section(html, 'price')).toContain('Price is available after the order is weighed and services are chosen.');
    expect(section(html, 'price')).not.toContain('<button');
```

4. **M5 Section 2 correction 1.** Replace the test `'shows the recorded weight, the total and the lines once priced'` with one whose name and assertions target the right sections:

```tsx
  it('shows the recorded weight, and the Final price breakdown in Price only, once priced', async () => {
    const priced = (id: string, unit: Line['pricingSnapshot']['unit'], quantity: number, amount: number, rate: number, description: string, extra: Partial<Line> = {}, minimum: number | null = null) => {
      const base = line(id, unit, quantity, amount, extra);
      return {
        ...base,
        pricingSnapshot: {
          ...base.pricingSnapshot,
          description,
          minimumChargeApplied: minimum !== null,
          minimumChargeMinorUnits: minimum,
          rateMinorUnits: rate,
        },
      };
    };
    page.order = order({
      lines: {
        nodes: [
          priced('l1', 'PER_KG', 2505, 30000, 5000, 'Wash & fold', {}, 30000),
          priced('l2', 'PER_ITEM', 3, 9000, 3000, 'Ironing (add-on)', { addOnId: 'a1', serviceId: null }),
          priced('l3', 'FLAT', 1, 6000, 6000, 'Softener (add-on)', { addOnId: 'a2', serviceId: null }),
        ],
        pageInfo: { hasNextPage: false },
      },
      status: 'PRICED',
    });
    const html = await renderPage();
    const overview = section(html, 'overview');
    expect(overview).toContain('3 services priced.');
    expect(overview).toMatch(/<a[^>]*href="#laundry-order-price"[^>]*>See Price<\/a>/);
    expect(overview).not.toContain('#laundry-order-services');
    expect(overview).not.toContain('<li');
    const services = section(html, 'services');
    expect(services).toContain('Services are locked because this order has been priced.');
    expect(services).not.toContain('<li');
    expect(services).not.toContain('Wash &amp; fold');
    expect(services).not.toContain('₱');
    const price = section(html, 'price');
    expect(price).toContain('Final price');
    expect(price).not.toContain('Estimate');
    expect(price).not.toContain('Confirm price');
    expect(price).not.toContain('<button');
    expect(count(price, '<li')).toBe(3);
    for (const text of ['Wash &amp; fold', 'Ironing (add-on)', 'Softener (add-on)', '2.505 kg', '3 items', '₱50.00 per kg', '₱30.00 per item', '₱60.00 flat', '₱300.00', '₱90.00', 'Order total', '₱450.00']) {
      expect(price).toContain(text);
    }
    expect(count(price, 'Minimum charge applied')).toBe(1);
    expect(price).toContain('Minimum charge applied (₱300.00).');
    expect(price).not.toContain('More lines are not loaded.');
    expect(section(html, 'weighing')).toContain('Recorded weight');
    expect(section(html, 'weighing')).toContain('2.505 kg');
  });
```

5. Rename `'points to Services with a singular count for one saved line'` to `'points to Price with a singular count for one saved line'`, and add `expect(overview).toContain('href="#laundry-order-price"');`.
6. In `describe('Services editor and views (#158)')`:
   - **`'offers the editor to OPS_MANAGER …'`:**
     - rename it to `'offers the editor and the Estimate card to OPS_MANAGER on a weighed order, with controls only in Weighing, Services and Price'`;
     - delete `expect(services).toContain('This is a preview. The price is final only after you confirm it.');`;
     - replace `const outside = html.replace(section(html, 'weighing'), '').replace(services, '');` with:

```tsx
      const price = section(html, 'price');
      expect(price).toContain('>Estimate<');
      expect(price).not.toContain('Final price');
      expect(price).toContain('Select a base service to see an estimate.');
      expect(price).toMatch(/<button[^>]*disabled=""[^>]*>Confirm price<\/button>/);
      const outside = html.replace(section(html, 'weighing'), '').replace(services, '').replace(price, '');
```

   - **`'renders an empty Services body while the role loads on a weighed order'`:** rename it to `'renders empty Services and Price bodies while the role loads on a weighed order with no total'`. Replace `const services = section(await renderPage(), 'services');` with `const html = await renderPage();` and `const services = section(html, 'services');`, so both sections come from one render (M5 final review). At the end, add (M5 round 2):

```tsx
      const price = section(html, 'price');
      // The body is empty: only the heading renders.
      expect(price).toMatch(/<\/h2><div[^>]*><\/div><\/section>$/);
      for (const absent of ['Estimate', 'Confirm price', '<button', 'Price is available after', 'This order was not priced.', 'Final price']) {
        expect(price).not.toContain(absent);
      }
```

   - **`it.each(['CUSTOMER_SUPPORT', 'FINANCE', 'ANALYST', 'SUPER_ADMIN'])('shows %s no editor on a weighed order', …)`:**
     - rename it to `'shows %s no editor and no Confirm on a weighed order'`;
     - replace `const services = section(await renderPage(), 'services');` with `const html = await renderPage(); const services = section(html, 'services');`;
     - at the end, add:

```tsx
      const price = section(html, 'price');
      expect(price).toContain('Price is available after the order is weighed and services are chosen.');
      expect(price).not.toContain('Confirm price');
      expect(price).not.toContain('<button');
      expect(price).not.toContain('Estimate');
```

   - **`'locks Services and lists the saved lines on a priced order for CUSTOMER_SUPPORT'`:** replace it with:

```tsx
    it('locks Services and shows the Final price to CUSTOMER_SUPPORT on a priced order', async () => {
      page.order = order({ lines: { nodes: [line('l1', 'FLAT', 1, 100)], pageInfo: { hasNextPage: false } }, status: 'PRICED' });
      page.role = 'CUSTOMER_SUPPORT';
      const html = await renderPage();
      const services = section(html, 'services');
      expect(services).toContain('Services are locked because this order has been priced.');
      expect(services).not.toContain('Wash &amp; fold');
      expect(services).not.toContain('<input');
      const price = section(html, 'price');
      expect(price).toContain('Final price');
      expect(price).toContain('Wash &amp; fold');
      expect(price).not.toContain('Confirm price');
    });
```

   - **`'lists the saved lines of a %s order without the locked sentence'`:** replace it with (planning decision a). The fixture, lines with no total, cannot come from the API (lines and the total are written together in `priceLaundryOrder`), so it pins the safe outcome: neither section claims a price.

```tsx
    it.each(['CANCELLED', 'REJECTED'])('never calls a %s order without a total priced, even with lines in the payload', async (status) => {
      page.order = order({ lines: { nodes: [line('l1', 'FLAT', 1, 100)], pageInfo: { hasNextPage: false } }, status, totalMinorUnits: null });
      const html = await renderPage();
      const services = section(html, 'services');
      expect(services).toContain('No services selected yet.');
      expect(services).not.toContain('has been priced');
      expect(services).not.toContain('Wash &amp; fold');
      expect(services).not.toContain('<input');
      const price = section(html, 'price');
      expect(price).toContain('This order was not priced.');
      expect(price).not.toContain('Estimate');
      expect(price).not.toContain('Final price');
    });
```

   - **`'says no services were selected on a %s order without lines'`:** at the end, add `expect(section(await renderPage(), 'price')).toContain('This order was not priced.');`.
   - Add, inside the same `describe`:

```tsx
    it('shows the Final price for an order cancelled after pricing (§4.3 note 5)', async () => {
      page.order = order({ lines: { nodes: [line('l1', 'FLAT', 1, 45000)], pageInfo: { hasNextPage: false } }, status: 'CANCELLED', totalMinorUnits: 45000 });
      page.role = 'TENANT_OWNER';
      const price = section(await renderPage(), 'price');
      expect(price).toContain('Final price');
      expect(price).toContain('₱450.00');
      expect(price).not.toContain('Confirm price');
    });

    it('shows the Final price while the role loads on a priced order', async () => {
      page.order = order({ status: 'PRICED' });
      page.role = undefined;
      expect(section(await renderPage(), 'price')).toContain('Final price');
    });

    // M5 round 1: inconsistent status/total pairs (owner decision 5).
    it('shows PRICED with no total as not priced, with no editor, Estimate or Confirm', async () => {
      page.order = order({ lines: { nodes: [], pageInfo: { hasNextPage: false } }, status: 'PRICED', totalMinorUnits: null });
      page.role = 'OPS_MANAGER';
      const html = await renderPage();
      const price = section(html, 'price');
      expect(price).toContain('This order was not priced.');
      expect(price).not.toContain('Estimate');
      expect(price).not.toContain('<button');
      const services = section(html, 'services');
      expect(services).toContain('No services selected yet.');
      expect(services).not.toContain('has been priced');
      expect(services).not.toContain('<input');
    });

    it('shows the Final price for a later status with a total, to a role that cannot price', async () => {
      page.order = order({ lines: { nodes: [line('l1', 'FLAT', 1, 45000)], pageInfo: { hasNextPage: false } }, status: 'PROCESSING', totalMinorUnits: 45000 });
      page.role = 'CUSTOMER_SUPPORT';
      const html = await renderPage();
      const price = section(html, 'price');
      expect(price).toContain('Final price');
      expect(price).toContain('₱450.00');
      expect(price).not.toContain('<button');
      expect(section(html, 'services')).toContain('Services are locked because this order has been priced.');
    });
```

   The other two inconsistent-state cases the review named are already pinned: an unresolved role with no total on a WEIGHED order renders an empty Price body, with no Estimate, Confirm or fallback sentence (`'renders empty Services and Price bodies while the role loads on a weighed order with no total'`, above), and a role without the `price` verb sees no Confirm (`'shows %s no editor and no Confirm on a weighed order'`, above).

7. In `'offers the weighing editor to an operational role on a received order, and controls only there'`, nothing changes: Price shows a sentence with no button for `RECEIVED`.
8. **`'warns when more lines exist than were loaded'`:** replace its body with:

```tsx
    page.order = order({ lines: { nodes: [line('l1', 'FLAT', 1, 100)], pageInfo: { hasNextPage: true } } });
    const html = await renderPage();
    expect(section(html, 'price')).toContain('More lines are not loaded.');
    expect(section(html, 'services')).not.toContain('More lines are not loaded.');
    const overview = section(html, 'overview');
    expect(overview).toContain('Services are priced.');
    expect(overview).toContain('href="#laundry-order-price"');
    expect(overview).not.toMatch(/\d+ services? priced/);
```

The marker test (`'marks the next step forward as current …'`), including `['WEIGHED', 'OPS_MANAGER', 'services']`, is unchanged. It is the **characterization test** for owner decision 4.

- [ ] **Step 2: Write the page interaction tests (failing)**

Create `apps/web/lib/laundry-order-page.interaction.test.tsx`:

```tsx
// @vitest-environment jsdom
import type { PriceLaundryOrderInput, PricingUnit } from '@clensy/client';
import { ToastProvider } from '@clensy/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The real order page, the real selection and confirm hooks, the real
// editors and card, in jsdom (#162). Only the Apollo hooks, the preview
// client and the router are mocked.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const WASH = '11111111-1111-4111-8111-111111111111';
const SHOES = '22222222-2222-4222-8222-222222222222';
const IRON = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const SOFT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const WEIGHT = 2505;

interface CatalogEntry {
  id: string;
  name: string;
  rate: number;
  unit: PricingUnit;
}
const SERVICES: CatalogEntry[] = [
  { id: SHOES, name: 'Shoes', rate: 2500, unit: 'PER_ITEM' },
  { id: WASH, name: 'Wash', rate: 5000, unit: 'PER_KG' },
];
const ADD_ONS: CatalogEntry[] = [
  { id: IRON, name: 'Ironing', rate: 2500, unit: 'PER_ITEM' },
  { id: SOFT, name: 'Softener', rate: 15000, unit: 'FLAT' },
];

interface Deferred {
  options: unknown;
  reject: (error: unknown) => void;
  resolve: (value: unknown) => void;
}

const page = vi.hoisted(() => ({
  id: '3f2a9c1e-0b7d-4e55-9a10-6c2b8d4e7f01',
  invoice: vi.fn(),
  order: null as unknown,
  orderError: undefined as Error | undefined,
  paid: vi.fn(),
  preview: vi.fn(),
  previewCalls: [] as PriceLaundryOrderInput[],
  previewFail: null as unknown,
  price: vi.fn(),
  prices: [] as Deferred[],
  refetch: vi.fn(),
  refetches: [] as Deferred[],
  role: 'OPS_MANAGER',
  weigh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: page.id }),
  usePathname: () => `/app/laundry/${page.id}`,
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useApolloClient: () => ({ query: page.preview }),
}));

// The generated `ServicesQuery` / `AddOnsQuery` node shapes
// (`packages/client/src/generated/graphql.ts`). Neither carries a pricing
// unit: the unit is learned from the preview response (#158), which is why
// `CatalogEntry.unit` feeds only `answer` below. The catalog price is a
// deliberate 99900, so a figure on screen from anywhere but the preview fails
// the tests (§8.4.4).
function catalogNode(entry: CatalogEntry, listKey: 'addOns' | 'services') {
  return listKey === 'services'
    ? { active: true, activePricing: { priceMinorUnits: 99900 }, durationMinutes: 60, id: entry.id, name: entry.name }
    : { active: true, description: null, id: entry.id, name: entry.name, priceMinorUnits: 99900 };
}

function catalogQuery(entries: CatalogEntry[], listKey: 'addOns' | 'services') {
  return (options: { skip?: boolean; variables: { filter: { name?: { iLike: string } } } }) => {
    if (options.skip) return { data: undefined, error: undefined, loading: false };
    const text = (options.variables.filter.name?.iLike ?? '').replaceAll('%', '').toLowerCase();
    const nodes = entries.filter((entry) => entry.name.toLowerCase().includes(text)).map((entry) => catalogNode(entry, listKey));
    return {
      data: { [listKey]: { nodes, pageInfo: { hasNextPage: false, hasPreviousPage: false }, totalCount: nodes.length } },
      error: undefined,
      loading: false,
    };
  };
}

vi.mock('@clensy/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@clensy/client')>()),
  useAddOnsQuery: (options: never) => catalogQuery(ADD_ONS, 'addOns')(options),
  useCurrentAdminQuery: () => ({ data: { currentAdmin: { role: page.role } } }),
  useGenerateInvoiceFromOrderMutation: () => [page.invoice, { loading: false }],
  useInvoiceForOrderQuery: () => ({ data: { invoices: { nodes: [] } }, error: undefined, loading: false }),
  useLaundryOrderQuery: () => ({
    data: { laundryOrder: page.order },
    error: page.orderError,
    loading: false,
    refetch: page.refetch,
  }),
  useMarkLaundryOrderPaidMutation: () => [page.paid, { loading: false }],
  usePriceLaundryOrderMutation: () => [page.price, { loading: false }],
  useServicesQuery: (options: never) => catalogQuery(SERVICES, 'services')(options),
  useWeighLaundryOrderMutation: () => [page.weigh, { loading: false }],
}));

const { default: LaundryOrderPage } = await import('../app/app/laundry/[id]/page');

function weighed(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: '2026-10-15T09:00:00.000Z',
    customer: { fullName: 'Ana Reyes', id: 'c1' },
    fulfillmentType: 'PICKUP',
    id: page.id,
    lines: { nodes: [], pageInfo: { hasNextPage: false } },
    status: 'WEIGHED',
    totalMinorUnits: null,
    weightGrams: WEIGHT,
    ...overrides,
  };
}

function pricedOrder() {
  return weighed({
    lines: {
      nodes: [
        {
          addOnId: null,
          createdAt: '2026-10-15T09:05:00.000Z',
          id: 'l1',
          pricingSnapshot: {
            amountMinorUnits: 12345,
            description: 'Wash',
            minimumChargeApplied: false,
            minimumChargeMinorUnits: null,
            pricingRuleId: null,
            quantity: WEIGHT,
            rateMinorUnits: 5000,
            unit: 'PER_KG',
          },
          serviceId: WASH,
        },
      ],
      pageInfo: { hasNextPage: false },
    },
    status: 'PRICED',
    totalMinorUnits: 12345,
  });
}

// Each line's amount is 12345 and the total 99999, neither of them rate ×
// quantity: the page must show the server's figures (§8.4.4).
function answer(input: PriceLaundryOrderInput) {
  const line = (entry: CatalogEntry, kind: 'addOn' | 'service', quantity: number | null | undefined) => ({
    addOnId: kind === 'addOn' ? entry.id : null,
    amountMinorUnits: 12345,
    description: kind === 'addOn' ? `${entry.name} (add-on)` : entry.name,
    minimumChargeApplied: false,
    minimumChargeMinorUnits: null,
    quantity: entry.unit === 'PER_KG' ? WEIGHT : (quantity ?? 1),
    rateMinorUnits: entry.rate,
    serviceId: kind === 'service' ? entry.id : null,
    unit: entry.unit,
  });
  const lines = [line(SERVICES.find((entry) => entry.id === input.baseServiceId)!, 'service', input.baseQuantity)];
  for (const sent of input.addOns) lines.push(line(ADD_ONS.find((entry) => entry.id === sent.addOnId)!, 'addOn', sent.quantity));
  return { data: { previewLaundryOrderPrice: { estimatedTotalMinorUnits: 99999, lines } } };
}

let container: HTMLDivElement;
let root: Root;

function deferred(list: Deferred[]) {
  return (options?: unknown) =>
    new Promise((resolve, reject) => {
      list.push({ options, reject, resolve });
    });
}

beforeEach(() => {
  vi.useFakeTimers();
  page.order = weighed();
  page.orderError = undefined;
  page.role = 'OPS_MANAGER';
  page.previewCalls.length = 0;
  page.previewFail = null;
  page.preview.mockReset();
  page.preview.mockImplementation((options: { variables: { input: PriceLaundryOrderInput } }) => {
    page.previewCalls.push(options.variables.input);
    return page.previewFail === null ? Promise.resolve(answer(options.variables.input)) : Promise.reject(page.previewFail);
  });
  page.prices.length = 0;
  page.price.mockReset();
  page.price.mockImplementation(deferred(page.prices));
  page.refetches.length = 0;
  page.refetch.mockReset();
  page.refetch.mockImplementation(deferred(page.refetches));
  page.invoice.mockReset();
  page.paid.mockReset();
  page.weigh.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  // Issue Acceptance: Confirm never generates an invoice or marks an order paid.
  expect(page.invoice).not.toHaveBeenCalled();
  expect(page.paid).not.toHaveBeenCalled();
  expect(page.weigh).not.toHaveBeenCalled();
});

function mount() {
  act(() =>
    root.render(
      <ToastProvider>
        <LaundryOrderPage />
      </ToastProvider>,
    ),
  );
}

async function settle(rounds = 1) {
  for (let round = 0; round < rounds; round += 1) {
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
  }
}

async function finish(list: Deferred[], index: number, how: 'reject' | 'resolve', value: unknown) {
  await act(async () => {
    list[index]![how](value);
  });
}

// Settles refetch `index` the way Apollo leaves the order query afterwards
// (M5 round 1). It does NOT exercise Apollo's refetch: `useLaundryOrderQuery`
// is mocked to read `page`. It sets the query state the real hook would
// expose (new data on success, `error` on failure), settles the promise the
// page awaits, and re-renders, so the page's response to that state is what
// these tests prove.
async function settleRefetch(index: number, outcome: { error: Error } | { order: unknown }) {
  if ('order' in outcome) {
    page.order = outcome.order;
    await finish(page.refetches, index, 'resolve', { data: { laundryOrder: outcome.order } });
  } else {
    page.orderError = outcome.error;
    await finish(page.refetches, index, 'reject', outcome.error);
  }
  mount();
}

function section(name: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`#laundry-order-${name}`);
  expect(found, name).not.toBeNull();
  return found!;
}

function priceText(): string {
  return section('price').textContent ?? '';
}

function confirmButton(): HTMLButtonElement {
  const found = [...section('price').querySelectorAll('button')].find((button) => /^Confirm(ing…| price)$/.test(button.textContent ?? ''));
  expect(found, 'Confirm').toBeDefined();
  return found!;
}

function controls(name: string): (HTMLInputElement | HTMLButtonElement)[] {
  return [...section(name).querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button')];
}

function type(target: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(target, value);
    target.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const baseInput = () => container.querySelector<HTMLInputElement>('#laundry-base-service')!;

async function pick(target: HTMLInputElement, id: string, rounds = 3) {
  act(() => target.focus());
  await settle();
  act(() => container.querySelector<HTMLElement>(`#${target.id}-option-${id}`)!.click());
  await settle(rounds);
}

async function addAddOn(id: string) {
  act(() => [...section('services').querySelectorAll('button')].find((button) => button.textContent === 'Add add-on')!.click());
  const inputs = [...section('services').querySelectorAll<HTMLInputElement>('input')].filter((input) => /^laundry-add-on-\d+$/.test(input.id));
  await pick(inputs[inputs.length - 1]!, id);
}

async function readyWithWash() {
  mount();
  await pick(baseInput(), WASH);
  expect(confirmButton().disabled).toBe(false);
}

describe('order page price review (#162)', () => {
  it('case 1: builds the estimate from the preview and enables Confirm only when ready', async () => {
    mount();
    expect(priceText()).toContain('Estimate');
    expect(priceText()).toContain('Select a base service to see an estimate.');
    expect(confirmButton().disabled).toBe(true);
    await pick(baseInput(), WASH);
    for (const text of ['Wash', '2.505 kg', '₱50.00 per kg', '₱123.45', 'Estimated total', '₱999.99']) {
      expect(priceText()).toContain(text);
    }
    // The preview's rate, never the catalog list price (moved from the editor test, case 17).
    expect(container.textContent).not.toContain('₱999.00');
    expect(priceText()).not.toContain('Final price');
    expect(confirmButton().disabled).toBe(false);
  });

  it('case 2: an empty add-on row, then a pending preview, keep Confirm disabled with no breakdown', async () => {
    await readyWithWash();
    act(() => [...section('services').querySelectorAll('button')].find((button) => button.textContent === 'Add add-on')!.click());
    expect(priceText()).toContain('Finish choosing services to see an estimate.');
    expect(priceText()).not.toContain('₱123.45');
    expect(confirmButton().disabled).toBe(true);
    const row = [...section('services').querySelectorAll<HTMLInputElement>('input')].find((input) => /^laundry-add-on-\d+$/.test(input.id))!;
    act(() => row.focus());
    await settle();
    act(() => container.querySelector<HTMLElement>(`#${row.id}-option-${SOFT}`)!.click());
    expect(priceText()).toContain('Updating estimate…');
    expect(priceText()).not.toContain('₱123.45');
    expect(confirmButton().disabled).toBe(true);
    await settle(2);
    expect(priceText()).toContain('Softener (add-on)');
    expect(confirmButton().disabled).toBe(false);
  });

  it('case 3: a per-kg base sends no baseQuantity', async () => {
    await readyWithWash();
    act(() => confirmButton().click());
    expect(page.price).toHaveBeenCalledTimes(1);
    const sent = (page.prices[0]!.options as { variables: { input: PriceLaundryOrderInput } }).variables.input;
    expect(sent).toEqual({ addOns: [], baseServiceId: WASH, orderId: page.id });
    expect('baseQuantity' in sent).toBe(false);
  });

  it('case 4: a per-item base sends its count; only a per-item add-on sends a quantity', async () => {
    mount();
    await pick(baseInput(), SHOES);
    await addAddOn(IRON);
    await addAddOn(SOFT);
    expect(confirmButton().disabled).toBe(false);
    act(() => confirmButton().click());
    const sent = (page.prices[0]!.options as { variables: { input: PriceLaundryOrderInput } }).variables.input;
    expect(sent).toEqual({
      addOns: [{ addOnId: IRON, quantity: 1 }, { addOnId: SOFT }],
      baseQuantity: 1,
      baseServiceId: SHOES,
      orderId: page.id,
    });
    expect(sent).toEqual(page.previewCalls[page.previewCalls.length - 1]);
  });

  it('case 5: success toasts, keeps both editors disabled through the refetch, then shows the Final price', async () => {
    await readyWithWash();
    act(() => confirmButton().click());
    expect(confirmButton().textContent).toBe('Confirming…');
    expect(confirmButton().disabled).toBe(true);
    expect(controls('services').every((control) => control.disabled)).toBe(true);
    expect(controls('weighing').every((control) => control.disabled)).toBe(true);
    await finish(page.prices, 0, 'resolve', { data: { priceLaundryOrder: { id: page.id } } });
    expect(document.body.textContent).toContain('Price confirmed.');
    expect(page.refetch).toHaveBeenCalledTimes(1);
    expect(controls('services').every((control) => control.disabled)).toBe(true);
    expect(controls('weighing').every((control) => control.disabled)).toBe(true);
    await settleRefetch(0, { order: pricedOrder() });
    expect(priceText()).toContain('Final price');
    expect(priceText()).not.toContain('Confirm price');
    expect(priceText()).not.toContain('Estimate');
    expect(section('services').textContent).toContain('Services are locked because this order has been priced.');
    expect(section('services').querySelector('input')).toBeNull();
    expect(section('weighing').querySelector('form')).toBeNull();
    expect(page.price).toHaveBeenCalledTimes(1);
  });

  // M5 Section 2 correction 2: both clicks land before React re-renders.
  it('case 6: a double click before the re-render sends one request', async () => {
    await readyWithWash();
    const button = confirmButton();
    act(() => {
      button.click();
      button.click();
    });
    expect(page.price).toHaveBeenCalledTimes(1);
  });

  it('case 7: a failure keeps the selection, disables the editors until the refetch settles, and clears on edit', async () => {
    await readyWithWash();
    act(() => confirmButton().click());
    await finish(page.prices, 0, 'reject', {
      graphQLErrors: [{ extensions: { originalError: { message: 'No effective price for serviceId x' } }, message: 'Bad Request Exception' }],
    });
    expect(section('price').querySelector('[role="alert"]')?.textContent).toBe('No effective price for serviceId x');
    expect(page.refetch).toHaveBeenCalledTimes(1);
    expect(controls('services').every((control) => control.disabled)).toBe(true);
    expect(controls('weighing').every((control) => control.disabled)).toBe(true);
    await settleRefetch(0, { order: weighed() });
    expect(controls('services').some((control) => control.disabled)).toBe(false);
    expect(controls('weighing').some((control) => control.disabled)).toBe(false);
    expect(baseInput().value).toBe('Wash');
    expect(section('price').querySelector('[role="alert"]')?.textContent).toBe('No effective price for serviceId x');
    expect(confirmButton().disabled).toBe(false);
    type(baseInput(), 'Was');
    expect(section('price').querySelector('[role="alert"]')).toBeNull();
  });

  it('case 8: a failure with no server message says "Unable to price order."', async () => {
    await readyWithWash();
    act(() => confirmButton().click());
    await finish(page.prices, 0, 'reject', new Error('network down'));
    expect(section('price').querySelector('[role="alert"]')?.textContent).toBe('Unable to price order.');
    await settleRefetch(0, { order: weighed() });
  });

  // Review focus 2: another actor cancelled the order first.
  it('case 9: after a failure, the refetched status replaces the estimate', async () => {
    await readyWithWash();
    act(() => confirmButton().click());
    await finish(page.prices, 0, 'reject', new Error('network down'));
    await settleRefetch(0, { order: weighed({ status: 'CANCELLED' }) });
    expect(priceText()).toContain('This order was not priced.');
    expect(section('price').querySelector('button')).toBeNull();
  });

  it('case 10: a failed refetch leaves the page error state, not a priceable order', async () => {
    await readyWithWash();
    act(() => confirmButton().click());
    await finish(page.prices, 0, 'resolve', { data: { priceLaundryOrder: { id: page.id } } });
    await settleRefetch(0, { error: new Error('reload failed') });
    expect(container.textContent).toContain('Unable to load laundry order.');
    expect(container.querySelector('#laundry-order-price')).toBeNull();
  });

  // Review focus 1: a re-weigh makes the quote stale.
  it('case 11: a new recorded weight sends the estimate back to Updating with Confirm disabled', async () => {
    await readyWithWash();
    page.order = weighed({ weightGrams: 3000 });
    mount();
    expect(priceText()).toContain('Updating estimate…');
    expect(priceText()).not.toContain('₱123.45');
    expect(confirmButton().disabled).toBe(true);
    await settle();
    expect(confirmButton().disabled).toBe(false);
  });

  it('case 12: Try again re-sends the same input after a failed preview', async () => {
    mount();
    page.previewFail = new Error('network down');
    await pick(baseInput(), WASH, 1);
    expect(priceText()).toContain('Couldn’t calculate the estimate.');
    expect(section('services').querySelector('[role="alert"]')?.textContent).toBe('Couldn’t preview the price.');
    expect(confirmButton().disabled).toBe(true);
    const before = page.previewCalls.length;
    page.previewFail = null;
    act(() => [...section('price').querySelectorAll('button')].find((button) => button.textContent === 'Try again')!.click());
    expect(priceText()).toContain('Updating estimate…');
    await settle();
    expect(page.previewCalls.length).toBe(before + 1);
    expect(page.previewCalls[before]).toEqual(page.previewCalls[before - 1]);
    expect(baseInput().value).toBe('Wash');
    expect(confirmButton().disabled).toBe(false);
  });

  // M5 round 1: a selection change after the estimate is shown makes it stale.
  it('case 13: a new base after the estimate is shown hides the old rows and disables Confirm until its preview arrives', async () => {
    await readyWithWash();
    expect(priceText()).toContain('₱123.45');
    type(baseInput(), 'Sho');
    await pick(baseInput(), SHOES, 0);
    expect(priceText()).toContain('Updating estimate…');
    expect(priceText()).not.toContain('Wash');
    expect(priceText()).not.toContain('₱123.45');
    expect(priceText()).not.toContain('₱999.99');
    expect(confirmButton().disabled).toBe(true);
    await settle(3);
    expect(priceText()).toContain('Shoes');
    expect(confirmButton().disabled).toBe(false);
  });
});
```

- [ ] **Step 3: Run the page tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/laundry-order-page.render.test.tsx lib/laundry-order-page.interaction.test.tsx`
Expected: FAIL. The render cases changed in Step 1 fail on the Price and Overview assertions, and every interaction case fails because the Price section has no Estimate card yet. The unchanged render cases pass.

- [ ] **Step 4: Wire the page**

In `apps/web/app/app/laundry/[id]/page.tsx`:

1. Imports:
   - add `import { LaundryPriceCard } from '../../../../components/laundry/laundry-price-card';` after the `LaundryServicesEditor` import;
   - remove `laundryLineQuantity,` from the `laundry-order-page` import;
   - after that import, add:

```tsx
import {
  laundryEstimateState,
  laundryPreviewRows,
  laundryPriceView,
  laundrySnapshotRows,
  type LaundryPriceView,
} from '../../../../lib/laundry-price-review';
```

   - after the `use-laundry-service-selection` import, add `import { useConfirmLaundryPrice, type ConfirmLaundryPriceState } from '../../../../lib/use-confirm-laundry-price';`.

2. Replace the file's header comment:

```tsx
// The order workspace (lifecycle spec §8.4.4, #156). Weighing records a
// weight (#155). Services chooses the base service and add-ons and
// previews their units and rates (#158). Price (#162), Invoice (#166) and
// Actions (#165) still show facts until their issues add controls. The list
// still opens the drawer until the cutover (#161).
```

with:

```tsx
// The order workspace (lifecycle spec §8.4.4, #156). Weighing records a
// weight (#155). Services chooses the base service and add-ons (#158).
// Price shows the estimate and confirms it, or the final price (#162).
// Invoice (#166) and Actions (#165) still show facts until their issues add
// controls. The list still opens the drawer until the cutover (#161).
```

3. In `LaundryOrderWorkspace`, after `const role = adminData?.currentAdmin.role;`, add:

```tsx
  // Lives here, above Weighing and Price, so both editors are disabled
  // while a price is confirmed and its refetch runs (#162 owner decision 6.3).
  const confirmPrice = useConfirmLaundryPrice({ refetch: () => orderQuery.refetch() });
```

4. Replace `<WeighingBody order={order} verbs={verbs} onRecorded={() => orderQuery.refetch()} t={t} />` with:

```tsx
        <WeighingBody
          disabled={confirmPrice.confirming}
          order={order}
          verbs={verbs}
          onRecorded={() => orderQuery.refetch()}
          t={t}
        />
```

and `<PricingSections order={order} roleResolved={role !== undefined} verbs={verbs} t={t} />` with `<PricingSections confirmPrice={confirmPrice} order={order} roleResolved={role !== undefined} verbs={verbs} t={t} />`.

5. In `OverviewBody`, replace the comment line `// at Services, which owns the line list (owner decision 1). The count is` with `// at Price, which owns the line list (#162 owner decision 1). The count is`. Replace:

```tsx
      <a href={`#${laundryOrderSectionId('services')}`} className="underline">
        {t('order.overview.seeServices')}
      </a>
```

with:

```tsx
      <a href={`#${laundryOrderSectionId('price')}`} className="underline">
        {t('order.overview.seePrice')}
      </a>
```

6. In `WeighingBody`, add `disabled,` to the destructuring and `disabled: boolean;` to its props type. Replace `<LaundryWeighingEditor onRecorded={onRecorded} orderId={order.id} weightGrams={order.weightGrams} />` with `<LaundryWeighingEditor disabled={disabled} onRecorded={onRecorded} orderId={order.id} weightGrams={order.weightGrams} />`.

7. Replace the whole `PricingSections`, `ServicesBody` and `SavedLines` functions, from the comment `// Services and Price share the selection and its current preview (#158).` through the end of `SavedLines`, with:

```tsx
// Services and Price share the selection and its current preview (#158).
// The state lives here, above both sections, so Price reads it instead of
// starting a second preview (#162). The workspace is keyed by order id, so
// another order starts with an empty selection.
function PricingSections({
  confirmPrice,
  order,
  roleResolved,
  t,
  verbs,
}: {
  confirmPrice: ConfirmLaundryPriceState;
  order: LaundryOrderDetail;
  roleResolved: boolean;
  t: Translate;
  verbs: readonly LaundryOrderVerb[];
}) {
  const view = laundryServicesView({
    hasTotal: order.totalMinorUnits !== null,
    roleResolved,
    status: order.status,
    verbs,
  });
  const selection = useLaundryServiceSelection({
    enabled: view === 'editor',
    orderId: order.id,
    weightGrams: order.weightGrams,
  });
  const priceView = laundryPriceView({
    hasTotal: order.totalMinorUnits !== null,
    roleResolved,
    status: order.status,
    verbs,
  });
  return (
    <>
      <OrderSection section="services" t={t}>
        <ServicesBody disabled={confirmPrice.confirming} selection={selection} t={t} view={view} />
      </OrderSection>

      <OrderSection section="price" t={t}>
        <PriceBody confirmPrice={confirmPrice} order={order} selection={selection} t={t} view={priceView} />
      </OrderSection>
    </>
  );
}

// Owner decision 4 (#158). Price lists a priced order's lines (#162 owner
// decision 1). `locked` is keyed on the persisted total, the same signal as
// Price's Final card, so the two sections never disagree (#162 planning
// decision a).
function ServicesBody({
  disabled,
  selection,
  t,
  view,
}: {
  disabled: boolean;
  selection: LaundryServiceSelectionState;
  t: Translate;
  view: LaundryServicesView;
}) {
  switch (view) {
    case 'hidden':
      return null;
    case 'editor':
      return <LaundryServicesEditor disabled={disabled} state={selection} />;
    case 'beforeWeigh':
      return <p>{t('order.services.beforeWeigh')}</p>;
    case 'none':
      return <p>{t('order.services.none')}</p>;
    case 'locked':
      return <p>{t('order.services.locked')}</p>;
  }
}

// #162 owner decision 5. A final price comes from the frozen snapshot
// (§8.4.2, §8.4.4) and never calls the preview. An estimate comes from the
// current preview only, and Confirm sends that preview's input unchanged
// (owner decision 6.1).
function PriceBody({
  confirmPrice,
  order,
  selection,
  t,
  view,
}: {
  confirmPrice: ConfirmLaundryPriceState;
  order: LaundryOrderDetail;
  selection: LaundryServiceSelectionState;
  t: Translate;
  view: LaundryPriceView;
}) {
  if (view === 'final' && order.totalMinorUnits !== null) {
    return (
      <LaundryPriceCard
        kind="final"
        more={order.lines.pageInfo.hasNextPage === true}
        rows={laundrySnapshotRows(order.lines.nodes)}
        totalMinorUnits={order.totalMinorUnits}
      />
    );
  }
  if (view === 'beforePricing') return <p>{t('order.price.beforePricing')}</p>;
  if (view === 'notPriced') return <p>{t('order.price.notPriced')}</p>;
  if (view !== 'estimate') return null;
  const { preview, priceInput, ready } = selection;
  // Only for the selection Confirm used: any edit replaces the object
  // (planning decision e).
  const failure = confirmPrice.failure?.selection === selection.selection ? confirmPrice.failure.message : undefined;
  return (
    <LaundryPriceCard
      kind="estimate"
      confirming={confirmPrice.confirming}
      failure={failure}
      rows={preview ? laundryPreviewRows(preview.lines) : []}
      state={laundryEstimateState({
        complete: selection.complete,
        hasBase: selection.selection.base !== null,
        previewError: selection.previewError !== null,
        previewLoading: selection.previewLoading,
        ready,
      })}
      totalMinorUnits={preview?.estimatedTotalMinorUnits ?? null}
      onConfirm={() => {
        if (ready && priceInput) void confirmPrice.confirm(priceInput, selection.selection);
      }}
      onRetry={selection.retryPreview}
    />
  );
}
```

- [ ] **Step 5: Update the copy (planning decision g)**

Run: `grep -rn "order\.lines\.\|order\.unit\.\|seeServices" apps packages --include=*.ts --include=*.tsx | grep -v node_modules`
Expected: no hit outside `laundry.ts`, since the page no longer uses them. If anything else uses one, keep that key and record it in M6.

In `packages/web/src/i18n/messages/en/laundry.ts`:
- delete the `lines: { … }` block under `order`;
- delete the `unit: { … }` block under `order`;
- under `overview`, replace `seeServices: 'See Services',` with `seePrice: 'See Price',`;
- under `price`, replace `notPriced: 'Not priced yet.',` with `notPriced: 'This order was not priced.',`.

- [ ] **Step 6: Run the page tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/laundry-order-page.render.test.tsx lib/laundry-order-page.interaction.test.tsx lib/laundry-order-page.test.ts`
Expected: PASS. (`ToastProvider` renders its toasts in-tree, after its children, so `document.body.textContent` sees them.)

- [ ] **Step 7: Commit**

```bash
git add 'apps/web/app/app/laundry/[id]/page.tsx' packages/web/src/i18n/messages/en/laundry.ts apps/web/lib/laundry-order-page.render.test.tsx apps/web/lib/laundry-order-page.interaction.test.tsx
git commit -m "feat(162): review and confirm the price on the order page"
```

---

### Task 7: Verification and browser check

No new behavior. This task records evidence for M6.

- [ ] **Step 1: Run the full checks**

Run each command and record the **actual** result (pass/fail, file and test counts, exit code) in the Execution record:
  - `pnpm --filter web test`
  - `pnpm --filter web lint`
  - `pnpm --filter web exec tsc --noEmit`
  - `pnpm --filter @clensy/web test`
  - `pnpm --filter @clensy/web lint`
  - `pnpm --filter @clensy/web build`

Expected: all pass. A failure is fixed in the task that owns the code, re-run, and recorded with both results.

- [ ] **Step 2: Confirm the unchanged paths**

Run: `git diff --stat main...HEAD -- apps/api packages/client packages/ui 'apps/web/app/app/laundry/page.tsx'`
Expected: empty. API suites are recorded **NOT RUN**: this slice changes no API code, and they are not claimed as covered.

- [ ] **Step 3: Browser check**

With the dev stack running and seeded data, sign in as an OPS_MANAGER on a `WEIGHED` order at 1280 px and at 375 px width:
- the Estimate card states (no base, loading, ready, failed with Try again);
- a long service name wraps with the amount right-aligned;
- there is no horizontal scroll at 375 px;
- Confirm shows "Confirming…", the toast shows, and the card becomes Final price.

Repeat as CUSTOMER_SUPPORT on a `WEIGHED` and a `PRICED` order.

Record each check separately from the automated tests. If seeded data cannot produce a state (for example a minimum charge), record that check as **not run** with the reason. Do not substitute another check for it.

- [ ] **Step 4: Commit the Execution record**

```bash
git add docs/superpowers/plans/2026-10-15-laundry-price-review-plan.md
git commit -m "docs(162): record the M6 verification"
```

---

## Traceability

| Requirement | Source | Task |
|---|---|---|
| Estimate card from the preview; "Estimate" eyebrow; no "Total due"/"Invoice" | §8.4.4; issue Layout, Acceptance | 4, 6 |
| Line name, unit, quantity, rate, amount, minimum note, estimated total match the preview | §8.4.5; issue Acceptance | 1, 4, 6 (case 1) |
| Confirm calls `priceLaundryOrder` once; no invoice/paid mutation | §8.4.4; issue Confirm, Acceptance | 3, 6 (cases 3–6) |
| Variables: `baseQuantity` only for `PER_ITEM`; add-on quantity only for `PER_ITEM` | §4.5 step 3a; issue Tests | 6 (cases 3, 4) |
| Final price from the snapshot, no Confirm; no preview once priced | §8.4.2, §8.4.4; issue Layout | 1, 4, 6 |
| Operational roles only; others see Final or the sentence | §4.4; issue Acceptance; decision 5 | 1, 6 |
| No client arithmetic | §8.4.4; issue Acceptance | 1 (case 2), 6 (case 1) |
| No edit-price or reprice action | §8.6; issue Immutability | Global constraints |
| Price owns the breakdown; Overview link; Services locked only | Decision 1 | 6 |
| Services locked exactly when there is a total; Price and Services never disagree | Planning decision (a); M5 round 1 | 1, 6 |
| Inconsistent status/total pairs are safe and non-editable | Decision 5; outcome table | 1, 4 (case 8), 6 |
| Editor keeps selection only | Decision 2 | 5 |
| Estimate states and retry | Decision 3; #158 M7 items 2, 3 | 1, 2, 4, 6 (cases 2, 12, 13) |
| No `ready` blip on A→B→A, for a ready or a failed result | #158 M7 item 1 | 2 (cases 20, 24) |
| Nav marker unchanged | Decision 4 | 6 (characterization) |
| Confirm flow, guard, frozen editors, refetch on both paths | Decision 6 | 3, 5, 6 (cases 5–10) |

## Execution record

### M6 — 2026-10-16

Executed inline (Native), in plan order, on `feat/162-laundry-price-review` from the M5 acceptance commit `8c8d928`. Every `Expected:` line was compared with the real output.

| Task | Commits | Red | Green |
|---|---|---|---|
| 1 | `4fe3b4c` | `laundry-price-review.test.ts`: import unresolved. `laundry-service-selection.test.ts`: 244 failed (every total-true case outside the editor, priced statuses without a total, role-loading with a `price` verb) | 502/502 and 547/547 |
| 2 | `0313266` | 6 failed: cases 20, 22 (×3), 23, 24 (`retryPreview is not a function`, `complete` undefined, a second request on the A→B→A return) | 39/39 |
| 3 | `238bbfd` | `./use-confirm-laundry-price` unresolved | 9/9 |
| 4 | `774e0a7` | `../components/laundry/laundry-price-card` unresolved | 11/11 |
| 5 | `5c87a9c` | 10 failed: services cases 1, 3, 4, 5 (×2), 6, 17, 20, 21 and the weighing disabled case | 659/659 (editor, hook and selection suites together) |
| 6 | `30e3f76`, `0646366` | Render: 19 failed. Interaction: 13 of 13 failed (no Estimate card) | 149/149 (render, interaction, page helpers) |

**Characterization tests** (pass before the change; shown able to fail against a deliberate break made outside the committed change, then reverted):
- Task 2, hook case 21: dropping the generation check from the A→B→A guard made it fail (`expected 2 to be 3`).
- Task 6, the section-marker test `['WEIGHED', 'OPS_MANAGER', 'services']`: mapping the `price` verb to `price` in `currentLaundryOrderSection` made it fail.
- Task 4, the Confirm-disabled assertions: forcing `disabled={false}` failed card cases 3 (×4), 4 and 8.

**Rulings (deviations from the plan's text):**
1. Task 4: the card tests checked the Confirm tag for the substring `disabled`, which `@clensy/ui` `Button`'s classes (`disabled:pointer-events-none` …) always contain, so case 2 failed and cases 3, 4 and 8 passed vacuously. They assert the attribute `disabled=""` instead.
2. Task 5: services case 20 called `countInput(rowOf(…))`, but the existing helper takes the search input. It now passes `addOnInputs()[0]`.
3. Task 5: case 20's "nothing left enabled" check excludes the harness's own `#elsewhere` button, which is outside the editor.
4. Task 6: `pnpm --filter web lint` (first run at Task 6) failed 19 ordering errors (`sort-type-constituents`, `contextforge/record-key-order`) in plan-supplied code. Fixed by reordering only, in `0646366`.

**Interim failures:** after Task 1, the two cases of `'lists the saved lines of a %s order…'` failed, as the plan said. After Task 5, `'offers the editor to OPS_MANAGER …'` also failed on the removed preview note, which the plan did not list; Task 6 Step 1 replaced both.

**Copy removal greps** (Task 5 Step 6, Task 6 Step 5): no translation-key use outside `laundry.ts`. The only `order.lines.` hits are data properties (`order.lines.nodes` in the API and the list page).

### Task 7 — verification (actual results)

| Check | Result |
|---|---|
| `pnpm --filter web test` | PASS — 48 files, 2176 tests, exit 0 |
| `pnpm --filter web lint` | PASS — exit 0 |
| `pnpm --filter web exec tsc --noEmit` | PASS — exit 0 |
| `pnpm --filter @clensy/web test` | PASS — 16 files, 417 tests, exit 0 |
| `pnpm --filter @clensy/web lint` | PASS — exit 0 |
| `pnpm --filter @clensy/web build` | PASS — exit 0 |
| `git diff --stat main...HEAD -- apps/api packages/client packages/ui 'apps/web/app/app/laundry/page.tsx'` | Empty |
| API suites | **NOT RUN** — no API code changes in this slice; not claimed as covered |

**Browser check.** The local Docker stack (built 2026-10-09) predated #159's preview query, so with the owner's approval it was rebuilt from this branch (`docker compose up -d --build`; the migrate step reported no pending migrations). A headless Chromium script signed in as the seed TENANT_OWNER and opened WEIGHED order `6b5c8992-…` at 1280 px and 375 px:

| Check | 1280 px | 375 px |
|---|---|---|
| No base: "Select a base service to see an estimate.", Confirm disabled | PASS | PASS |
| Loading: "Updating estimate…" right after choosing | PASS | PASS |
| Failed (preview request aborted): "Couldn’t calculate the estimate." with Try again | PASS | PASS |
| Try again: "Updating estimate…", then ready | PASS | PASS |
| Ready: name, "2.50 kg", "₱15.00 per kg", "₱37.50", Estimated total "₱37.50", Confirm enabled | PASS | PASS |
| Long name wraps in the left column, amount right-aligned | PASS | PASS (name box 241 px wide, amount at the right edge) |
| No horizontal scroll | PASS | PASS (before and after Confirm) |
| Confirm reads "Confirming…", the toast "Price confirmed." shows, the card becomes Final price, Services shows the locked sentence | — | PASS |

Not run, with reasons:
- **CUSTOMER_SUPPORT on a WEIGHED and a PRICED order:** no password for a CUSTOMER_SUPPORT account in this database. Covered only by the render tests (`'shows %s no editor and no Confirm on a weighed order'`, `'locks Services and shows the Final price to CUSTOMER_SUPPORT on a priced order'`).
- **Minimum-charge note, per-item rows:** the seeded catalog for this tenant has no minimum-charge rule and no per-item service. Covered only by card cases 2 and 5.

Observation outside this slice: at 375 px the existing toast sits flush against the left edge of the viewport. The toast is `@clensy/ui`'s, unchanged here.

### M7 — Approved for merge (2026-10-16)

A fresh, independent agent on the most capable model (Opus 5.5) reviewed `47e90b1..bfc179d` against the Accepted spec and this plan. It did not write the change. **This is not a self-review.**
- **Re-ran:**
  - `pnpm --filter web test`: 48 files, 2176 passed;
  - `pnpm --filter web lint`, `pnpm --filter web exec tsc --noEmit` and `pnpm --filter @clensy/web lint`: exit 0;
  - `pnpm --filter @clensy/web test`: 16 files, 417 passed;
  - the unchanged-paths diff, including `docs/workflows/**`: empty;
  - commit trailers: none.
- **`@clensy/web build`:** not re-run, because it writes build output. The reviewer relied on the M6 record.
- **Conformance:** Tasks 1–7 covered, nothing reordered, skipped or added. It checked §8.4.2, §8.4.4, §8.4.5, §4.3 note 5, §4.4 and §8.6. Each Review focus item, and each race traced (double Confirm, editors frozen through the refetch on both paths, A→B→A with an in-flight B, retry with no key), is handled and pinned by a test.
- **The four M6 rulings:** each judged correct.
- **Blocking findings:** none.
- **Minor findings, non-blocking:**
  1. Confirm is not blocked while a weight save is in flight. A weight recorded just before Confirm can be priced before the page has refetched, so the Final price uses the new weight rather than the estimate on screen. The server's figure is correct. The plan's owner decision 6.3 freezes the editors during Confirm, not the reverse.
  2. The browser check signed in as the seed TENANT_OWNER, not OPS_MANAGER as Task 7 names. Both are operational roles with the same `price` verb and code path.
  3. The A→B→A skip reuses a settled result however long B lasted. It is no staler than a preview left on screen, and the server reprices at Confirm.
- **Declined to judge:** estimate staleness after a catalog change (#158 behaviour); focus after Confirm (not specified); the toast position at 375 px (`@clensy/ui`, out of scope); Weighing's sentence in the inconsistent rows (owner put it out of scope).

