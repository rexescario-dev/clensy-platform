# Multi-Entry Laundry Weighing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | **Accepted (revision 8)**. M6 complete ([Execution record](#execution-record)); M7 Approved for merge (independent review); M8 N/A; M9 complete; M10 validated; owner-directed follow-ups re-reviewed and approved ([Follow-ups](#owner-directed-follow-ups-post-m7)). PR [#185](https://github.com/rexescario-dev/clensy-platform/pull/185). |
| M5 decision | **Accepted** — 2026-10-14, revision 8 (`003f6ce`), by the owner, after the Part 4 re-check and a final Part 5 pass. Every finding raised in parts 1–5 is resolved: the Task 1 transaction boundary (rev 3), Task 2–3 negative precedence and the error-shape guard (rev 4, 7), the Task 4 error policy, stale alert, total-error a11y (rev 5) and typed weigh mock (rev 8), and the Task 5–6 markup, reload-failure and reporting changes (rev 6). Part 5 found no blocking issue in Tasks 5–6, traceability, deferrals or risks. No planning decision (a)–(g) was returned, so all stand as written. The acceptance covers the plan, not the implementation. The reviewer relied on the supplied pre-validation evidence and did not rerun the commands. Task 1, Task 5, Task 6, each expected-failure step and the browser checklist stay unverified until M6 runs them and records the results. |
| M5 history | Part 1 (2026-10-14, owner): provisional. **P1:** the entry contract called every non-digit, non-point character a format error, contradicting the negative-entry message. Resolved in revision 2: Global Constraints now fix the classification order (blank → leading minus → format → notPositive → tooLarge), and Task 2 adds `-1.2345`, `--1` and `1-` as format cases. **Verify (refetch):** Task 4 adds a test that every control stays disabled until the post-save refetch settles. **Verify (oversize):** already covered by Task 2's `tooLarge` cases and Task 4's over-maximum tests. Each row is capped at `MAX_WEIGHT_GRAMS` before it is summed, so the total `formatWeightGrams` receives is always a safe integer. Part 2 (2026-10-14, owner): **P1:** the zero-weight service test asserted only `manager.update`, not the promised "before opening a transaction". Resolved in revision 3: the test also asserts `dataSource.transaction`, `manager.findOne` and `auditLogger.log` were not called, the spec's existing boundary pattern (`receive` / `price` guard tests). The DTO and service messages stay intentionally distinct. Part 3 (2026-10-14, owner): **P1:** the parser comment did not state that a negative with more than three decimals is `format`. Resolved in revision 4: the comment and Global Constraints spell out the precedence (format checks before the negative check). **P2:** `-99999999` must be `notPositive`, not `tooLarge`. The planned code already checks the minus before the oversize check; revision 4 adds `-99999999` as a regression case and says so in Global Constraints. **Suggestion (accepted):** `graphQLErrorMessage` returns `undefined` for a first error that is `null` or not an object, with three new cases. The priced set stays an explicit list. Part 4 (2026-10-14, owner): **P1 (error policy):** resolved in revision 5. The spike shows the effective policy is Apollo 3.14's default `'none'`: there are no `defaultOptions` anywhere, and the `onError` link only observes. So GraphQL errors reject. The contract is documented in Task 4, and the handler also treats a resolved result with errors or without the order as a failure (decision g). **P1 (sync throw from `onRecorded`):** the reviewer withdrew it; no change. **P2 (stale alert):** an edit, add, remove or new submit clears the server error, with four tests. **P2 (resolved-error path):** two tests cover a resolved result with errors and one with no order; the mock's default success now carries the order. **P2 (total error a11y):** the total-level error has id `laundry-weighing-form-error` and describes Record weight, asserted in the over-maximum and no-rows tests; the live region stays on the total only. Part 5 (2026-10-14, owner): verdict **not accepted yet**. The summary table repeats the part 1–4 findings; revisions 3–5 had already resolved them before part 5 was sent (transaction boundary: rev 3; negative precedence and `-99999999`: rev 4, already ordered in the code; error policy, stale alert, total-error a11y: rev 5). New in part 5, resolved in revision 6. **Brittle markup:** the Task 5 render test drops the exact Tailwind class and ordered-attribute assertions; the live total is checked by `role="status"` and `aria-live="polite"` on the tag holding `0.00 kg`. **Page-level refetch failure:** a Task 5 characterization test shows the post-save reload failure renders the order error state with no weighing failure and no editor. The stated guarantee is narrowed: the editor guarantees no weighing error, the page shows its existing #156 branch, and Apollo setting `error` is library behavior. **Task 6:** the report must record each command as PASS, FAIL or NOT RUN, state that authorization and status enforcement stay server-side, say whether the API tests ran, and list the release-gate and tenant-isolation suites as excluded, not as covered. Part 3 re-check (2026-10-14, owner): Task 1 confirmed resolved; Task 3 has no blocking finding. The reviewer asked for proof that `-99999999` is `notPositive` in the committed code, not only in a comment. Revision 7 ran Task 2's planned code and tests verbatim (see Pre-validation): the `if (negative)` check precedes the size check, and the `-99999999` case passes. The same run's lint found that the `WeightEntryResult` union order violated `sort-type-constituents`; it is reordered in revision 7, with no behavior change. Part 4 re-check (2026-10-14, owner): **P1:** the weigh mock's `resolve(result?: unknown)` was too permissive. Resolved in revision 8: the test types the mock result as Apollo 3.14's `FetchResult<WeighLaundryOrderMutation>` and its variables as the generated `WeighLaundryOrderMutationVariables`. The success default is a full `LaundryOrderDetail`-shaped `RECORDED` fixture, and the resolved-errors and missing-order fixtures must satisfy the same type. `tsc --noEmit` proves they do (see Pre-validation). Behavior unchanged. Part 4 follow-up (2026-10-14, owner): the typing finding is resolved, on the supplied evidence. Part 5 final pass (2026-10-14, owner): no blocking issue; M5 acceptance recommended for revision 8. See M5 decision. |
| Date | 2026-10-14 |
| Tracking issue | [#155](https://github.com/rexescario-dev/clensy-platform/issues/155) "Multi-entry laundry weighing". Epic [#154](https://github.com/rexescario-dev/clensy-platform/issues/154). Depends on [#156](https://github.com/rexescario-dev/clensy-platform/issues/156) (merged in #183: the order page and its Weighing section) and [#157](https://github.com/rexescario-dev/clensy-platform/issues/157) (closed: `formatWeightGrams`, `laundryOrderActions`). The spec gate in #155 is met: [#164](https://github.com/rexescario-dev/clensy-platform/issues/164) §8.4.1 is Accepted (#167), so this slice takes the issue's "if Accepted" branch (issue comment, 2026-10-14). |
| Branch | `feat/155-multi-entry-laundry-weighing`, from `main` at `c6b6c75`. One PR for this plan, its M5 record and the implementation. |
| Scope | `apps/api`: the weigh input's minimum, the service check, one comment, tests. `apps/web`: a new pure module, a new error-message helper, one new helper in an existing module, a new component, the order page's Weighing section, tests. `packages/web`: `laundry.order.weighing` copy. **No** schema, migration, resolver signature, GraphQL type, operation document, codegen or `@clensy/ui` change. The list page `apps/web/app/app/laundry/page.tsx` (and its drawer) is **not** edited. No new dependency. |
| Implements (Accepted) | [Laundry Orders & Lifecycle](../specs/2026-09-06-laundry-orders-lifecycle-design.md), Status **Accepted** (2026-09-06), with **Amendment #164**, Accepted 2026-10-10. Governing text: **§8.4.1** ("`weightGrams` is `null` until the order is weighed, and thereafter an integer **≥ 1**. `weighLaundryOrder` rejects `0` and any negative or non-integer with `BadRequestException`. `WeighLaundryOrderInput.weightGrams` uses that same minimum. The UI rejects blank, non-numeric, zero, and negative entries and must not be the only check." Stored `0` rows are not rewritten.) **§8.4.4**, weighing bullet ("Weighing UI may show multiple temporary rows. The client sums them, in whole grams, at most three decimal places of kilograms, and submits one `weightGrams`. The server remains authoritative. Re-weigh stays legal only in `RECEIVED` and `WEIGHED`."). **§8.2** (no bag table; rows are client input only). **§4.4** (`weighLaundryOrder`: status ∈ {`RECEIVED`, `WEIGHED`}; roles OWNER, OPS_MANAGER, SCHEDULER; re-weigh of `WEIGHED` is state-preserving). **§4.5** (after `PRICED`, `weightGrams` is immutable). **§4.3** (the matrix, which decides which statuses imply pricing). **§4.7** (`WeighLaundryOrderInput { orderId: ID!, weightGrams: Int! }`). |
| Relies on (Accepted, merged) | [Laundry Order Page plan](2026-10-14-laundry-order-page-plan.md) (#156): the route, `OrderSection`, `Fact`, the page render-test harness, `currentLaundryOrderSection` (unchanged: Weighing is current only for `RECEIVED`). [Laundry UI Foundation plan](2026-10-10-laundry-ui-foundation-plan.md) (#157): `formatWeightGrams`, `laundryOrderActions` (its `weigh` verb is `RECEIVED`/`WEIGHED` ∩ OPERATIONAL), `LAUNDRY_ORDER_STATUSES`. [Laundry Intake Modal plan](2026-10-13-laundry-intake-modal-plan.md) (#160): the synchronous in-flight guard idiom, the `role="alert"` form error, the jsdom interaction-test harness. `@clensy/ui` `FormField` (label, `aria-invalid`, `aria-describedby`), `Button`, `useToast`. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. Issue #155 refines §8.4.4 with layout, copy, validation and test requirements. File names, helper names, copy keys, element ids and task order are planning decisions, not product semantics. |
| Owner decisions (M4, 2026-10-14) | **(1) Locked copy only once priced.** "Weight is locked because this order has been priced." shows, to every role, only for a status that implies pricing: `PRICED`, `AWAITING_PAYMENT`, `PAID`, `PROCESSING`, `READY`, `AWAITING_PICKUP`, `AWAITING_DELIVERY`, `COMPLETED`, `LOST`, `DAMAGED`, `REFUNDED`. `CANCELLED` and `REJECTED` never show it: they show the recorded weight, or "Not weighed yet.", and no form. `RECEIVED` / `WEIGHED` show the form only when `laundryOrderActions(...)` offers `weigh`, otherwise the read-only weight. **(2) Keep** the database CHECK at `>= 0`, no migration, and a fresh independent M7 reviewer (API code changes). |
| Planning decisions for M5 to confirm | Not in the issue or spec. Each is the smallest choice that keeps the stated contract; M5 may return any of them. **(a)** `CANCELLED` is outside the priced set even when the order was cancelled after pricing (§4.3 allows `PRICED → CANCELLED`): the status alone cannot tell, and owner decision 1 forbids the locked copy for `CANCELLED`. Such an order shows its recorded weight. **(b)** A row above the GraphQL `Int` maximum (2,147,483,647 g) shows "Enter a smaller weight.", and a combined total above it shows "The combined weight is too large to record." Without this, a long digit string either crashes the shared formatter (`RangeError` past `Number.MAX_SAFE_INTEGER`) or sends a value the `Int!` input cannot carry. **(c)** A row's inline error appears once the row has been left (blur) or after a submit attempt, not on load, so the prefilled empty row is not red on arrival. **(d)** Whitespace is not trimmed: `" 1.25"` is the format error, as the issue's "any character that is not a digit or a single decimal point" says. `"1."` (1000 g) and `".5"` (500 g) are accepted, because splitting on `.` yields a valid whole and fraction. **(e)** Controls stay disabled until the post-save refetch settles as well as the mutation, so a second weigh cannot start before the page shows the saved weight. **(f)** Plain React state, not `react-hook-form`: the rows are a dynamic list validated by one pure function. **(g)** A resolved weigh result with GraphQL errors or without the order is a failure (defense in depth over the `'none'` policy). An edit, add, remove or new submit clears an earlier server error. The total-level error has a fixed id that describes Record weight. |
| Edit anchors | New files are given in full. Edits to existing files are given against `main` at `c6b6c75`. Apply each by the quoted code, not by line number. |
| Package names | `pnpm --filter api` is `apps/api`. `pnpm --filter web` is `apps/web`. `pnpm --filter @clensy/web` is `packages/web`. |
| Pre-validation | **Partial: Tasks 2–4** (revision 8). Every Task 2, 3 and 4 file and edit (new modules and tests, the `laundry-order-page` append and test edits, the `laundry.ts` copy, the editor and its interaction test) was applied verbatim from this plan to a clean tree, run, then reverted. Results: `pnpm --filter web test` → 37 files, 949 tests passed, including the 168 tests of the four Task 2–4 files. `pnpm --filter web lint` → clean after the revision 8 fixture key-order fix. `pnpm --filter web exec tsc --noEmit` → clean, so the typed `FetchResult<WeighLaundryOrderMutation>` fixtures compile. `pnpm --filter @clensy/web test` → 15 files, 411 passed. `@clensy/web` `lint` and `build` → clean. **Not run:** Task 1 (API unit, e2e, lint), Task 5, Task 6, each task's expected-failure step, and every commit. A first spike attempt failed 29 editor tests only because the extraction script copied the old copy block; with the planned block applied, all pass. Other read-only spikes are under [Planning spikes](#planning-spikes). |
| M7 | Application code changes, including API validation. `CLAUDE.md` requires a **fresh independent reviewer** on the most capable model, given this plan, the Accepted spec and the branch diff. |

**Goal:** Front-counter staff record one order weight from several bag, basket or batch entries on `/app/laundry/<id>`, without a calculator. The server rejects a zero weight (§8.4.1).

**Architecture:**

- **API (`apps/api`):** `WeighLaundryOrderInput.weightGrams` goes from `@Min(0)` to `@Min(1)`, and `LaundryOrdersService.weigh` rejects `< 1`. Two layers, because the service is also called directly (tests, future callers) without the DTO pipe. The database CHECK stays `>= 0`.
- **Pure parsing (`apps/web/lib/laundry-weight-entries.ts`):**
  - `parseWeightEntry` turns one kilogram string into whole grams by splitting on `.`. It never multiplies a float.
  - `summarizeWeightEntries` sums the valid rows and says whether the form may submit.
  - `kilogramsInputFromGrams` builds the re-weigh prefill.
- **Section view (`apps/web/lib/laundry-order-page.ts`):** `laundryWeighingView(status, verbs)` returns `'editor' | 'locked' | 'readOnly'`. It is built on an explicit `LAUNDRY_PRICED_STATUSES` set (owner decision 1).
- **Error text (`apps/web/lib/graphql-error-message.ts`):** `graphQLErrorMessage(error)` reads the server's message from an Apollo error, when there is one.
- **Editor (`apps/web/components/laundry/laundry-weighing-editor.tsx`):** owns the rows, the live total, the single `weighLaundryOrder` mutation, the in-flight guard, the toast and the alert. The page passes `orderId`, the recorded `weightGrams` and `onRecorded` (the order refetch).
- **Page (`apps/web/app/app/laundry/[id]/page.tsx`):** the Weighing section's body becomes `WeighingBody`, which picks the view. Nothing else on the page changes.

**Tech Stack:** NestJS 11 + class-validator (API), React 19, Next.js 16, Apollo Client 3.14 (`@clensy/client` generated hooks), Tailwind, Jest (API unit + e2e), Vitest (node `renderToStaticMarkup`, and jsdom with `createRoot` + `act`).

**Spec:** `docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md` §8.4.1, §8.4.4 (with §8.2, §4.3, §4.4, §4.5, §4.7).

## Global Constraints

Derived from the Accepted spec, issue #155 (with its two comments) and the owner decisions above. Every task's requirements implicitly include this section.

- **Server minimum (§8.4.1):** `WeighLaundryOrderInput.weightGrams` **SHALL** be `@IsInt() @Min(1)`. `LaundryOrdersService.weigh` **SHALL** throw `BadRequestException('weightGrams must be a positive integer')` for a non-integer or a value `< 1`, before opening a transaction. **SHALL NOT** add a migration or change `ck_laundry_order_weight_non_negative`. **SHALL NOT** rewrite stored `0` rows.
- **No per-bag data (§8.2, §8.6):** the mutation input stays `{ orderId, weightGrams }`. No bag rows are persisted, sent or stored in the URL.
- **One mutation:** `weighLaundryOrder({ orderId, weightGrams })` with the integer sum of the rows, at most once per submit. No float multiplication anywhere in the conversion (`Math.round(Number(kg) * 1000)` is forbidden).
- **Entry contract:** each entry is a decimal kilogram string with at most 3 decimal places. It is parsed by splitting on `.` into whole grams. More than 3 decimals is an error, never a silent round. The classification order is fixed, and the first rule that matches wins:
  1. **`blank`:** empty or whitespace-only.
  2. **Leading minus:** one leading `-` is removed and remembered. Only this position is special; a `-` anywhere else is just a forbidden character.
  3. **`format`:** the rest contains anything other than `0-9` and `.` (so `+`, `e`, `,`, whitespace and a second `-` all land here), has more than one `.`, has no digits, or has more than 3 decimals. A malformed negative such as `-abc` or `-1.2345` is therefore `format`.
  4. **`notPositive`:** the input had the leading minus (`-1`, `-0.5`, `-0`, and also `-99999999`, which is never `tooLarge`), or its value is zero (`0`, `0.000`).
  5. **`tooLarge`:** a positive value above `MAX_WEIGHT_GRAMS`.

  Task 2 pins each step, including `-1`, `-0.5`, `-0`, `0`, `-abc`, `-1.2345` and `-99999999`.
- **Validation copy (inline under the input):** blank "Enter a weight." · not a decimal kilogram "Enter a weight in kilograms, up to 3 decimal places." · zero or negative "Weight must be greater than zero." · above the `Int` maximum "Enter a smaller weight." (planning decision b). **Form:** no rows "Add at least one weight." · total above the `Int` maximum "The combined weight is too large to record."
- **Live total:** "Combined weight" in `rounded-md border border-slate-200 bg-slate-50 p-3`. The value, `formatWeightGrams(total)`, is in `text-lg font-semibold text-slate-900`, in a `role="status"` `aria-live="polite"` element. The total covers the valid rows only. It updates as the user types, and invalid rows still block submit.
- **Layout:**
  - **Section and editor:** the section's `h2` stays "Weighing". When a weight is recorded, "Recorded weight" plus the formatted weight sits above the editor. The editor is `flex flex-col gap-3`. Its description reads "Add each bag, basket, or batch. The order weight is the total."
  - **Rows:** each row is `flex flex-col gap-2 sm:flex-row sm:items-end`. Its label is "Bag {n}", numbered from 1 in row order and renumbered after a removal. The input is `inputMode="decimal"`. The Remove button is `variant="secondary"` with the visible label "Remove bag {n}".
  - **Buttons:** "Add bag" is `variant="secondary"`. "Record weight" is the primary button, `w-full sm:w-auto`.
- **Gates (owner decision 1):** `laundryWeighingView(status, laundryOrderActions(status, fulfillmentType, role))`:
  - `'editor'` when the verbs include `weigh`;
  - else `'locked'` when the status is in `LAUNDRY_PRICED_STATUSES`;
  - else `'readOnly'`.

  A role that is still loading yields no verbs, so the result is `'readOnly'` or `'locked'`, never `'editor'`.
- **Re-weigh (§4.4):** for a recorded weight, the editor starts with one row prefilled with `kilogramsInputFromGrams(weightGrams)`: three decimals, trailing zeros trimmed to at least two places (`2500` → `2.50`, `1005` → `1.005`). Otherwise it starts with one empty row. The recorded-weight line keeps the server value until the refetch after a successful save.
- **Submit:**
  - **While in flight:** Add, Remove, every input and Record weight are disabled. A synchronous ref drops repeat submits.
  - **Success:** toast "Weight recorded.", call `onRecorded()` (the order refetch), and leave one row prefilled with the saved total.
  - **Failure:** `<p role="alert">` with `graphQLErrorMessage(error)`, falling back to "Unable to record weight.". The rows are kept.
  - **Refetch failure:** a refetch that fails after a successful save shows no weighing error, and the controls re-enable (the editor's guarantee, Task 4). What the page then shows is its existing #156 order-error branch: Apollo keeps the old data and sets `error`, and the page renders "Unable to load laundry order." with the back link. Task 5 pins that branch for the post-save case. That Apollo sets `error` on a failed refetch is library behavior, not unit-tested here.
- **Accessibility:** every input has a visible `<label>`. Errors use `aria-invalid` and `aria-describedby`, through `FormField`. Every Remove button's accessible name includes the row number.
- **Boundaries:** app code imports UI only from `@clensy/ui` (project memory: never shadcn/ui directly). **SHALL NOT** edit `apps/web/app/app/laundry/page.tsx`, `currentLaundryOrderSection`, `@clensy/ui`, or the operation documents in `packages/client`.

## Review Focus

These failure modes follow from the spec or issue, but no line of the issue tests them. Each one is pinned by a test in the task named.

1. **A long digit string must not crash the page.** For example, a pasted `99999999999` must give an inline error, not a `RangeError` thrown by `formatWeightGrams` past `Number.MAX_SAFE_INTEGER`. Pinned in Task 2 (`tooLarge` cases) and Task 4 (the over-maximum total test).
2. **A comma decimal (`1,5`) or a pasted value with spaces is a visible format error,** never silently read as `15` or `1.5`. Pinned in Task 2.
3. **The refetch after a save can fail.** It must not show "Unable to record weight." for a weight that was recorded, and it must not leave the controls disabled. Pinned in Task 4 (editor) and Task 5 (page error state).
4. **A cancelled or rejected order never claims to be priced.** It must show its weight or "Not weighed yet." and no locked copy. Pinned in Task 3 (every status) and Task 5 (rendered).
5. **A legacy `WEIGHED` order stored with `0` grams** prefills `0.00`. The form must show "Weight must be greater than zero." on submit, not send `0`. Pinned in Task 4.

---

## Planning spikes

Read-only. Nothing below was committed.

- **Baselines at `c6b6c75`:** `pnpm --filter web test` → 34 files, 831 tests passed. `pnpm --filter api test -- laundry-orders.service` → 72 tests passed.
- **No test relies on a zero weigh.** `grep` over `apps/api/src` and `apps/api/test` finds no `weighLaundryOrder` / `svc.laundry.weigh` call with `weightGrams: 0`. The `0`-gram rows in the migration e2e specs are raw SQL inserts and bypass the service, so they are unaffected.
- **DTO error shape:** `packages/validation/src/normalize.ts` documents Nest's `ValidationPipe` failure as `extensions.originalError.message: string[]`, from a captured response. The intake interaction tests use that shape. A service `BadRequestException('…')` carries the string in both `message` and `extensions.originalError.message`. `graphQLErrorMessage` reads either.
- **Mutation error policy:** `packages/client/src/apollo-client.ts` sets no `defaultOptions`, the generated hooks spread `defaultOptions = {}`, and `sessionErrorLink` (`onError`) only observes. Apollo Client is 3.14.1, whose default mutation `errorPolicy` is `'none'`: GraphQL errors reject `mutate`. Task 4 still checks a resolved result (planning decision g).
- **`useToast` throws outside `ToastProvider`.** The page render test therefore wraps the page in `ToastProvider`, as the list interaction test does.
- **Copy has no interpolation.** `useClensyTranslations` returns raw strings. The `{n}` placeholder is filled with `.replace('{n}', …)`, the `disableConfirmDescription` precedent. The row number is digits only, so no `$` pattern applies.
- **`@clensy/web` resolves from source** (`main: src/index.ts`, Next `transpilePackages`), so no package build is needed for apps/web to see new copy.
- **Apollo 3 `refetch`** leaves `loading` `false` unless `notifyOnNetworkStatusChange` is set. The page sets no such option, so the page's loading check does not unmount the editor during the post-save refetch. This is not unit-testable in the static harness. Task 6 checks it in the browser.
- **The default render-test order is `AWAITING_PAYMENT`.** Its Weighing section becomes `'locked'`, so the existing "no `<button`, `<form` or `<input`" test keeps passing unchanged. Task 5 adds the narrowed assertion that the issue asks for: for an editable order, controls appear only inside Weighing.

## File map

| File | Change | Task |
| --- | --- | --- |
| `apps/api/src/modules/laundry/presentation/graphql/laundry-order.inputs.ts` | modify (`@Min(1)`) | 1 |
| `apps/api/src/modules/laundry/application/services/laundry-orders.service.ts` | modify (`< 1`, message) | 1 |
| `apps/api/src/modules/laundry/infrastructure/persistence/laundry-order.entity.ts` | modify (comment only) | 1 |
| `apps/api/src/modules/laundry/tests/application/laundry-orders.service.spec.ts` | modify (zero case) | 1 |
| `apps/api/src/modules/laundry/tests/graphql/laundry-order.inputs.spec.ts` | create | 1 |
| `apps/api/test/laundry.e2e-spec.ts` | modify (zero over GraphQL) | 1 |
| `apps/web/lib/laundry-weight-entries.ts` | create | 2 |
| `apps/web/lib/laundry-weight-entries.test.ts` | create | 2 |
| `apps/web/lib/laundry-order-page.ts` | modify (add `LAUNDRY_PRICED_STATUSES`, `laundryWeighingView`) | 3 |
| `apps/web/lib/laundry-order-page.test.ts` | modify | 3 |
| `apps/web/lib/graphql-error-message.ts` | create | 3 |
| `apps/web/lib/graphql-error-message.test.ts` | create | 3 |
| `packages/web/src/i18n/messages/en/laundry.ts` | modify (`order.weighing.*`) | 4 |
| `apps/web/components/laundry/laundry-weighing-editor.tsx` | create | 4 |
| `apps/web/lib/laundry-weighing-editor.interaction.test.tsx` | create | 4 |
| `apps/web/app/app/laundry/[id]/page.tsx` | modify (Weighing body) | 5 |
| `apps/web/lib/laundry-order-page.render.test.tsx` | modify | 5 |

---

### Task 1: The server rejects a zero weight (§8.4.1)

**Files:**
- Modify: `apps/api/src/modules/laundry/presentation/graphql/laundry-order.inputs.ts`
- Modify: `apps/api/src/modules/laundry/application/services/laundry-orders.service.ts`
- Modify: `apps/api/src/modules/laundry/infrastructure/persistence/laundry-order.entity.ts`
- Modify: `apps/api/src/modules/laundry/tests/application/laundry-orders.service.spec.ts`
- Create: `apps/api/src/modules/laundry/tests/graphql/laundry-order.inputs.spec.ts`
- Modify: `apps/api/test/laundry.e2e-spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `weighLaundryOrder` rejects `weightGrams: 0`. The DTO gives the constraint message `weightGrams must not be less than 1`. The service gives `weightGrams must be a positive integer`.

- [ ] **Step 1: Write the failing service test**

In `laundry-orders.service.spec.ts`, inside `describe('weigh', …)`, directly after the `it('rejects a negative weight', …)` block, add:

```ts
    it('rejects a zero weight before touching the order (Amendment #164 §8.4.1)', async () => {
      manager.findOne.mockResolvedValue(
        anOrder({ status: LaundryOrderStatus.RECEIVED }),
      );
      await expect(service.weigh(cmd({ weightGrams: 0 }))).rejects.toThrow(
        new BadRequestException('weightGrams must be a positive integer'),
      );
      // Rejected before the transaction opens: no transaction, no locked
      // read, no write, no audit (the spec's `dataSource.transaction`
      // boundary assertion, as in the receive and price guard tests).
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(manager.findOne).not.toHaveBeenCalled();
      expect(manager.update).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });
```

- [ ] **Step 2: Write the failing DTO test**

Create `apps/api/src/modules/laundry/tests/graphql/laundry-order.inputs.spec.ts`:

```ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WeighLaundryOrderInput } from '../../presentation/graphql/laundry-order.inputs';

// The weigh input's minimum (Amendment #164 §8.4.1). The global
// ValidationPipe runs these same decorators on every GraphQL call.
describe('WeighLaundryOrderInput', () => {
  async function constraintsFor(weightGrams: unknown): Promise<string[]> {
    const errors = await validate(
      plainToInstance(WeighLaundryOrderInput, { orderId: 'o1', weightGrams }),
    );
    return errors.flatMap((error) => Object.keys(error.constraints ?? {}));
  }

  it('accepts one gram', async () => {
    expect(await constraintsFor(1)).toEqual([]);
  });

  it('rejects zero with the min constraint', async () => {
    expect(await constraintsFor(0)).toEqual(['min']);
  });

  it('rejects a negative weight with the min constraint', async () => {
    expect(await constraintsFor(-1)).toEqual(['min']);
  });

  it('rejects a fractional weight with the int constraint', async () => {
    expect(await constraintsFor(1.5)).toEqual(['isInt']);
  });
});
```

- [ ] **Step 3: Run both to verify they fail**

Run: `pnpm --filter api test -- laundry-orders.service laundry-order.inputs`
Expected: FAIL. In the service test, the zero weigh does not throw: the service accepts `0` and calls `manager.update`. In the DTO test, `rejects zero with the min constraint` gets `[]`. The other three DTO cases pass. They are **characterization tests**: `@IsInt() @Min(0)` already accepts `1` and rejects `-1` and `1.5`.

- [ ] **Step 4: Implement the minimum**

In `laundry-order.inputs.ts`, replace:

```ts
  @Field(() => Int)
  @IsInt()
  @Min(0)
  weightGrams!: number;
```

with:

```ts
  // At least one gram (Amendment #164 §8.4.1). Stored 0-gram orders are
  // not rewritten; the rule applies to new weigh calls.
  @Field(() => Int)
  @IsInt()
  @Min(1)
  weightGrams!: number;
```

In `laundry-orders.service.ts`, replace:

```ts
    if (!Number.isInteger(command.weightGrams) || command.weightGrams < 0) {
      throw new BadRequestException(
        'weightGrams must be a non-negative integer',
      );
    }
```

with:

```ts
    // Amendment #164 §8.4.1: a weighed order has a positive weight. The
    // DTO enforces the same minimum; this guards direct service callers.
    if (!Number.isInteger(command.weightGrams) || command.weightGrams < 1) {
      throw new BadRequestException('weightGrams must be a positive integer');
    }
```

In `laundry-order.entity.ts`, replace:

```ts
// >= 0)` in the migration (spec §4.8) — defense-in-depth for the
// application-level non-negative-integer rule.
```

with:

```ts
// >= 0)` in the migration (spec §4.8). The application rule is stricter,
// at least 1 gram (Amendment #164 §8.4.1); the CHECK stays `>= 0` because
// stored 0-gram orders are not rewritten.
```

- [ ] **Step 5: Run the unit tests to verify they pass**

Run: `pnpm --filter api test -- laundry-orders.service laundry-order.inputs`
Expected: PASS. The service suite has 73 tests (72 plus the new one). The DTO suite has 4.

- [ ] **Step 6: Add the GraphQL e2e assertion**

In `apps/api/test/laundry.e2e-spec.ts`, in the golden-path test, directly **before** this existing block:

```ts
    await gql(
      cookie,
      `mutation($i: WeighLaundryOrderInput!){ weighLaundryOrder(input:$i){ status weightGrams } }`,
      { i: { orderId, weightGrams: 400 } },
    );
```

insert:

```ts
    // Amendment #164 §8.4.1: a zero weight is rejected over GraphQL by the
    // input's minimum, and the order stays RECEIVED and unweighed.
    const zero = await gql(
      cookie,
      `mutation($i: WeighLaundryOrderInput!){ weighLaundryOrder(input:$i){ status } }`,
      { i: { orderId, weightGrams: 0 } },
    );
    expect(zero.body.errors).toBeDefined();
    expect(JSON.stringify(zero.body.errors)).toContain(
      'weightGrams must not be less than 1',
    );
    const afterZero = await gql(
      cookie,
      `query($id: ID!){ laundryOrder(id:$id){ status weightGrams } }`,
      { id: orderId },
    );
    expect(afterZero.body.data.laundryOrder).toEqual({
      status: 'RECEIVED',
      weightGrams: null,
    });
```

- [ ] **Step 7: Run the laundry e2e suites**

Run: `pnpm --filter api test:e2e -- laundry.e2e-spec laundry.service.e2e-spec`
Expected: PASS (both suites; needs the local test Postgres as in earlier laundry slices). The golden path then weighs 400 g and prices as before.

- [ ] **Step 8: Lint and commit**

Run: `pnpm --filter api lint`
Expected: no errors. The script runs `--fix`, so check `git status --short` for formatting-only changes and keep them in this commit.

```bash
git status --short
git add apps/api/src/modules/laundry/presentation/graphql/laundry-order.inputs.ts \
  apps/api/src/modules/laundry/application/services/laundry-orders.service.ts \
  apps/api/src/modules/laundry/infrastructure/persistence/laundry-order.entity.ts \
  apps/api/src/modules/laundry/tests/application/laundry-orders.service.spec.ts \
  apps/api/src/modules/laundry/tests/graphql/laundry-order.inputs.spec.ts \
  apps/api/test/laundry.e2e-spec.ts
git commit -m "feat(api): reject a zero laundry weight (#155, Amendment #164 §8.4.1)"
```

---

### Task 2: Kilogram entries to whole grams

**Files:**
- Create: `apps/web/lib/laundry-weight-entries.ts`
- Test: `apps/web/lib/laundry-weight-entries.test.ts`

**Interfaces:**
- Consumes: `formatWeightGrams(grams: number): string` from `@clensy/web`.
- Produces:
  - `MAX_WEIGHT_GRAMS = 2_147_483_647`
  - `type WeightEntryError = 'blank' | 'format' | 'notPositive' | 'tooLarge'`
  - `type WeightEntryResult = { error: WeightEntryError; ok: false } | { grams: number; ok: true }`
  - `parseWeightEntry(text: string): WeightEntryResult`
  - `type WeightFormError = 'noEntries' | 'totalTooLarge'`
  - `interface WeightEntrySummary { formError: WeightFormError | null; results: WeightEntryResult[]; submittable: boolean; totalGrams: number }`
  - `summarizeWeightEntries(texts: readonly string[]): WeightEntrySummary`
  - `kilogramsInputFromGrams(grams: number): string`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/lib/laundry-weight-entries.test.ts`:

```ts
import { formatWeightGrams } from '@clensy/web';
import { describe, expect, it } from 'vitest';
import {
  MAX_WEIGHT_GRAMS,
  kilogramsInputFromGrams,
  parseWeightEntry,
  summarizeWeightEntries,
} from './laundry-weight-entries';

// #155 §Calculation: kilogram strings become whole grams by splitting on
// the decimal point, never by multiplying a float.
describe('parseWeightEntry', () => {
  it.each([
    ['1.25', 1250],
    ['0.80', 800],
    ['0.45', 450],
    ['0.001', 1],
    // 1.005 * 1000 is 1004.9999999999999 in binary floating point.
    ['1.005', 1005],
    ['2', 2000],
    ['1.', 1000],
    ['.5', 500],
    ['007.5', 7500],
    ['2147483.647', MAX_WEIGHT_GRAMS],
  ])('%j → %i g', (text, grams) => {
    expect(parseWeightEntry(text)).toEqual({ grams, ok: true });
  });

  it.each(['', '   '])('%j is blank', (text) => {
    expect(parseWeightEntry(text)).toEqual({ error: 'blank', ok: false });
  });

  it.each(['abc', '1.2.3', '1.2345', '+1', '1e3', '1,5', ' 1.25', '1.25 ', '.', '-', '-abc', '-1.2345', '--1', '1-', '0x10', '1_000'])(
    '%j is not a decimal kilogram',
    (text) => {
      expect(parseWeightEntry(text)).toEqual({ error: 'format', ok: false });
    },
  );

  // A negative is `notPositive` even when it is also too large.
  it.each(['0', '0.000', '00', '-1', '-0.5', '-0', '-99999999'])('%j is not greater than zero', (text) => {
    expect(parseWeightEntry(text)).toEqual({ error: 'notPositive', ok: false });
  });

  // GraphQL Int is signed 32-bit; a longer digit string must not reach the
  // formatter (which throws past MAX_SAFE_INTEGER) or the mutation.
  it.each(['2147483.648', '99999999', '12345678.5', '99999999999999999999'])('%j is too large', (text) => {
    expect(parseWeightEntry(text)).toEqual({ error: 'tooLarge', ok: false });
  });
});

describe('summarizeWeightEntries', () => {
  it('sums three valid rows to whole grams and allows submit', () => {
    const summary = summarizeWeightEntries(['1.25', '0.80', '0.45']);
    expect(summary.totalGrams).toBe(2500);
    expect(formatWeightGrams(summary.totalGrams)).toBe('2.50 kg');
    expect(summary.submittable).toBe(true);
    expect(summary.formError).toBeNull();
  });

  it('totals the valid rows but blocks submit while any row is invalid', () => {
    const summary = summarizeWeightEntries(['1.25', 'abc', '']);
    expect(summary.totalGrams).toBe(1250);
    expect(summary.submittable).toBe(false);
    expect(summary.formError).toBeNull();
    expect(summary.results.map((result) => result.ok)).toEqual([true, false, false]);
  });

  it('asks for at least one weight when there are no rows', () => {
    expect(summarizeWeightEntries([])).toEqual({ formError: 'noEntries', results: [], submittable: false, totalGrams: 0 });
  });

  it('blocks a combined total above the GraphQL Int maximum', () => {
    const summary = summarizeWeightEntries(['2000000', '2000000']);
    expect(summary.totalGrams).toBe(4_000_000_000);
    expect(summary.formError).toBe('totalTooLarge');
    expect(summary.submittable).toBe(false);
  });

  it('allows a total of exactly the maximum', () => {
    const summary = summarizeWeightEntries(['2147483', '0.647']);
    expect(summary.totalGrams).toBe(MAX_WEIGHT_GRAMS);
    expect(summary.submittable).toBe(true);
  });
});

describe('kilogramsInputFromGrams', () => {
  it.each([
    [2500, '2.50'],
    [1250, '1.25'],
    [1005, '1.005'],
    [1000, '1.00'],
    [1200, '1.20'],
    [1, '0.001'],
    [0, '0.00'],
  ])('%i g → %j', (grams, text) => {
    expect(kilogramsInputFromGrams(grams)).toBe(text);
  });

  it.each([1, 450, 1005, 2500, 123456, MAX_WEIGHT_GRAMS])('round-trips %i g through parseWeightEntry', (grams) => {
    expect(parseWeightEntry(kilogramsInputFromGrams(grams))).toEqual({ grams, ok: true });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test -- laundry-weight-entries`
Expected: FAIL, with "Failed to resolve import './laundry-weight-entries'".

- [ ] **Step 3: Implement the module**

Create `apps/web/lib/laundry-weight-entries.ts`:

```ts
import { formatWeightGrams } from '@clensy/web';

// The largest weight `weighLaundryOrder` can carry: `weightGrams` is a
// GraphQL `Int!` (lifecycle spec §4.7), a signed 32-bit integer.
export const MAX_WEIGHT_GRAMS = 2_147_483_647;

// 9,999,999 kg: past this, whole kilograms exceed MAX_WEIGHT_GRAMS anyway,
// and the gram arithmetic below stays far inside MAX_SAFE_INTEGER.
const MAX_WHOLE_KILOGRAM_DIGITS = 7;

export type WeightEntryError = 'blank' | 'format' | 'notPositive' | 'tooLarge';

export type WeightEntryResult = { error: WeightEntryError; ok: false } | { grams: number; ok: true };

// One weight row (#155 §Calculation, lifecycle spec §8.4.4): a decimal
// kilogram string with at most three decimal places, so it is an exact
// whole number of grams. Split on the decimal point and add integers;
// never multiply a float (1.005 * 1000 is not 1005). Only ASCII digits and
// one point are accepted: no sign, exponent, comma or whitespace.
// Precedence (Global Constraints): blank; then one leading minus is set
// aside; then the format checks run on the rest, so a malformed negative
// (`-abc`, `-1.2345`) is `format`; then a negative that is otherwise a
// valid decimal (`-1`, `-0.5`, `-99999999`) is `notPositive`, as is zero
// (lifecycle spec §8.4.1); only then is a positive value `tooLarge`.
export function parseWeightEntry(text: string): WeightEntryResult {
  if (text.trim() === '') return { error: 'blank', ok: false };
  const negative = text.startsWith('-');
  const body = negative ? text.slice(1) : text;
  if (!/^[0-9.]+$/.test(body)) return { error: 'format', ok: false };
  const parts = body.split('.');
  if (parts.length > 2) return { error: 'format', ok: false };
  const [whole, fraction = ''] = parts;
  if (whole === '' && fraction === '') return { error: 'format', ok: false };
  if (fraction.length > 3) return { error: 'format', ok: false };
  if (negative) return { error: 'notPositive', ok: false };
  const wholeDigits = whole.replace(/^0+/, '');
  if (wholeDigits.length > MAX_WHOLE_KILOGRAM_DIGITS) return { error: 'tooLarge', ok: false };
  const grams = Number(wholeDigits === '' ? '0' : wholeDigits) * 1000 + Number(fraction.padEnd(3, '0'));
  if (grams === 0) return { error: 'notPositive', ok: false };
  if (grams > MAX_WEIGHT_GRAMS) return { error: 'tooLarge', ok: false };
  return { grams, ok: true };
}

export type WeightFormError = 'noEntries' | 'totalTooLarge';

export interface WeightEntrySummary {
  // `noEntries` with no rows; `totalTooLarge` when the valid rows add up
  // past MAX_WEIGHT_GRAMS; otherwise `null`.
  formError: WeightFormError | null;
  // One result per row, in row order.
  results: WeightEntryResult[];
  // At least one row, every row valid, and a total the mutation can carry.
  submittable: boolean;
  // The sum of the valid rows only. Shown live, even while a row is invalid.
  totalGrams: number;
}

export function summarizeWeightEntries(texts: readonly string[]): WeightEntrySummary {
  const results = texts.map(parseWeightEntry);
  const totalGrams = results.reduce((sum, result) => (result.ok ? sum + result.grams : sum), 0);
  const formError: WeightFormError | null =
    texts.length === 0 ? 'noEntries' : totalGrams > MAX_WEIGHT_GRAMS ? 'totalTooLarge' : null;
  const submittable = formError === null && results.every((result) => result.ok);
  return { formError, results, submittable, totalGrams };
}

// The re-weigh prefill (#155 §Re-weigh): the recorded grams as a kilogram
// entry, three decimals with trailing zeros trimmed to at least two. That
// is the shared formatter's number without its unit, so the field and the
// "Recorded weight" line always agree.
export function kilogramsInputFromGrams(grams: number): string {
  return formatWeightGrams(grams).replace(/ kg$/, '');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web test -- laundry-weight-entries`
Expected: PASS (all cases).

- [ ] **Step 5: Lint and commit**

Run: `pnpm --filter web lint`
Expected: no errors. If `contextforge/record-key-order` or `sort-type-constituents` flags a literal, reorder the keys or members. Change no behavior.

```bash
git status --short
git add apps/web/lib/laundry-weight-entries.ts apps/web/lib/laundry-weight-entries.test.ts
git commit -m "feat(web): parse laundry weight entries into whole grams (#155)"
```

---

### Task 3: The Weighing view and the server error text

**Files:**
- Modify: `apps/web/lib/laundry-order-page.ts`
- Modify: `apps/web/lib/laundry-order-page.test.ts`
- Create: `apps/web/lib/graphql-error-message.ts`
- Test: `apps/web/lib/graphql-error-message.test.ts`

**Interfaces:**
- Consumes: `LaundryOrderStatus`, `LaundryOrderVerb`, `laundryOrderActions`, `LAUNDRY_ORDER_STATUSES` from `@clensy/web`.
- Produces:
  - `LAUNDRY_PRICED_STATUSES: ReadonlySet<LaundryOrderStatus>`
  - `type LaundryWeighingView = 'editor' | 'locked' | 'readOnly'`
  - `laundryWeighingView(status: LaundryOrderStatus, verbs: readonly LaundryOrderVerb[]): LaundryWeighingView`
  - `graphQLErrorMessage(error: unknown): string | undefined`

- [ ] **Step 1: Write the failing view tests**

In `apps/web/lib/laundry-order-page.test.ts`, change the first import to:

```ts
import { LAUNDRY_ORDER_STATUSES, laundryOrderActions, type AdminRole, type LaundryOrderStatus } from '@clensy/web';
```

Add `LAUNDRY_PRICED_STATUSES` and `laundryWeighingView` to the import from `./laundry-order-page`, keeping that list alphabetical:

```ts
import {
  LAUNDRY_ORDER_SECTIONS,
  LAUNDRY_PRICED_STATUSES,
  currentLaundryOrderSection,
  laundryDetailRedirectHref,
  laundryLifecycleVerbs,
  laundryLineQuantity,
  laundryOrderHref,
  laundryOrderSectionId,
  laundryWeighingView,
  resolvedInvoiceNodes,
  resolvedQueryData,
} from './laundry-order-page';
```

Append at the end of the file:

```ts
// Owner decision 1 (#155 M4): the locked copy is only for an order that
// was priced; CANCELLED and REJECTED never inherit it.
describe('LAUNDRY_PRICED_STATUSES', () => {
  it('is every status except the two before pricing and the two pre-payment exits', () => {
    const notPriced: LaundryOrderStatus[] = ['CANCELLED', 'RECEIVED', 'REJECTED', 'WEIGHED'];
    expect([...LAUNDRY_PRICED_STATUSES].sort()).toEqual(
      LAUNDRY_ORDER_STATUSES.filter((status) => !notPriced.includes(status)).sort(),
    );
    expect(LAUNDRY_PRICED_STATUSES.size).toBe(11);
  });
});

describe('laundryWeighingView', () => {
  const view = (status: LaundryOrderStatus, role: AdminRole | undefined) =>
    laundryWeighingView(status, laundryOrderActions(status, 'PICKUP', role));

  it.each(['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER'] as const)('offers the editor to %s on RECEIVED and WEIGHED', (role) => {
    expect(view('RECEIVED', role)).toBe('editor');
    expect(view('WEIGHED', role)).toBe('editor');
  });

  it.each(['CUSTOMER_SUPPORT', 'FINANCE', 'ANALYST'] as const)('shows %s the read-only weight on RECEIVED and WEIGHED', (role) => {
    expect(view('RECEIVED', role)).toBe('readOnly');
    expect(view('WEIGHED', role)).toBe('readOnly');
  });

  it('shows the read-only weight while the role loads', () => {
    expect(view('RECEIVED', undefined)).toBe('readOnly');
    expect(view('WEIGHED', undefined)).toBe('readOnly');
  });

  it.each([...LAUNDRY_PRICED_STATUSES])('locks %s for every role, including a loading one', (status) => {
    for (const role of ['TENANT_OWNER', 'SCHEDULER', 'CUSTOMER_SUPPORT', 'ANALYST', undefined] as const) {
      expect(view(status, role)).toBe('locked');
    }
  });

  it.each(['CANCELLED', 'REJECTED'] as const)('never locks %s', (status) => {
    expect(view(status, 'TENANT_OWNER')).toBe('readOnly');
    expect(view(status, 'ANALYST')).toBe('readOnly');
  });
});
```

- [ ] **Step 2: Write the failing error-text tests**

Create `apps/web/lib/graphql-error-message.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { graphQLErrorMessage } from './graphql-error-message';

describe('graphQLErrorMessage', () => {
  it("reads a service exception's message", () => {
    const error = {
      graphQLErrors: [
        {
          extensions: { originalError: { message: 'Cannot weigh a laundry order in status PRICED' } },
          message: 'Cannot weigh a laundry order in status PRICED',
        },
      ],
    };
    expect(graphQLErrorMessage(error)).toBe('Cannot weigh a laundry order in status PRICED');
  });

  it("reads the first constraint of a ValidationPipe failure, not Nest's generic message", () => {
    const error = {
      graphQLErrors: [
        {
          extensions: { originalError: { message: ['weightGrams must not be less than 1'] } },
          message: 'Bad Request Exception',
        },
      ],
    };
    expect(graphQLErrorMessage(error)).toBe('weightGrams must not be less than 1');
  });

  it('falls back to the GraphQL message without an original error', () => {
    expect(graphQLErrorMessage({ graphQLErrors: [{ message: 'Forbidden resource' }] })).toBe('Forbidden resource');
  });

  it.each([
    ['a network error', new Error('Failed to fetch')],
    ['an empty error list', { graphQLErrors: [] }],
    ['an empty message', { graphQLErrors: [{ message: '' }] }],
    ['a null first error', { graphQLErrors: [null] }],
    ['a string first error', { graphQLErrors: ['boom'] }],
    ['an extensions-less, message-less error', { graphQLErrors: [{}] }],
    ['null', null],
    ['a string', 'boom'],
  ])('has no server message for %s', (_label, error) => {
    expect(graphQLErrorMessage(error)).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `pnpm --filter web test -- laundry-order-page.test graphql-error-message`
Expected: FAIL. `LAUNDRY_PRICED_STATUSES` and `laundryWeighingView` are not exported, and `./graphql-error-message` does not resolve.

- [ ] **Step 4: Implement the view helper**

In `apps/web/lib/laundry-order-page.ts`, append after `currentLaundryOrderSection`:

```ts
// Statuses only a priced order can have: each lies downstream of
// WEIGHED → PRICED in the lifecycle matrix (spec §4.3), and the weight is
// then immutable (§4.5). CANCELLED is left out because RECEIVED and
// WEIGHED orders can be cancelled too, so the status alone does not prove
// pricing; REJECTED is only reachable before pricing (owner decision 1,
// #155 M4).
export const LAUNDRY_PRICED_STATUSES: ReadonlySet<LaundryOrderStatus> = new Set<LaundryOrderStatus>([
  'AWAITING_DELIVERY',
  'AWAITING_PAYMENT',
  'AWAITING_PICKUP',
  'COMPLETED',
  'DAMAGED',
  'LOST',
  'PAID',
  'PRICED',
  'PROCESSING',
  'READY',
  'REFUNDED',
]);

export type LaundryWeighingView = 'editor' | 'locked' | 'readOnly';

// What the Weighing section shows (#155): the editor when the actor may
// weigh (`laundryOrderActions` already intersects RECEIVED/WEIGHED with
// the operational roles, spec §4.4); the locked sentence for a priced
// order; otherwise the recorded weight or "Not weighed yet.".
export function laundryWeighingView(
  status: LaundryOrderStatus,
  verbs: readonly LaundryOrderVerb[],
): LaundryWeighingView {
  if (verbs.includes('weigh')) return 'editor';
  if (LAUNDRY_PRICED_STATUSES.has(status)) return 'locked';
  return 'readOnly';
}
```

- [ ] **Step 5: Implement the error-text helper**

Create `apps/web/lib/graphql-error-message.ts`:

```ts
interface ServerGraphQLError {
  extensions?: { originalError?: { message?: unknown } };
  message?: unknown;
}

// The server's own message on a failed Apollo mutation, for an inline
// alert (#155 §Submit: "the server message when Apollo exposes one").
// Nest puts a service exception's text, or a ValidationPipe failure's
// constraint list, in `extensions.originalError.message`; the top-level
// message of a pipe failure is only "Bad Request Exception". A network
// failure, or any other shape, has none: the caller shows its own copy.
export function graphQLErrorMessage(error: unknown): string | undefined {
  const errors = (error as { graphQLErrors?: unknown } | null | undefined)?.graphQLErrors;
  if (!Array.isArray(errors) || errors.length === 0) return undefined;
  const candidate: unknown = errors[0];
  if (typeof candidate !== 'object' || candidate === null) return undefined;
  const first = candidate as ServerGraphQLError;
  const original = first.extensions?.originalError?.message;
  if (typeof original === 'string' && original !== '') return original;
  if (Array.isArray(original) && typeof original[0] === 'string' && original[0] !== '') return original[0];
  return typeof first.message === 'string' && first.message !== '' ? first.message : undefined;
}
```

- [ ] **Step 6: Run to verify they pass**

Run: `pnpm --filter web test -- laundry-order-page.test graphql-error-message`
Expected: PASS. Every existing `laundry-order-page.test` case still passes.

- [ ] **Step 7: Lint, type-check and commit**

Run: `pnpm --filter web lint && pnpm --filter web exec tsc --noEmit`
Expected: no errors.

```bash
git status --short
git add apps/web/lib/laundry-order-page.ts apps/web/lib/laundry-order-page.test.ts \
  apps/web/lib/graphql-error-message.ts apps/web/lib/graphql-error-message.test.ts
git commit -m "feat(web): decide the laundry Weighing view and read server error text (#155)"
```

---

### Task 4: The weighing editor

**Files:**
- Modify: `packages/web/src/i18n/messages/en/laundry.ts`
- Create: `apps/web/components/laundry/laundry-weighing-editor.tsx`
- Test: `apps/web/lib/laundry-weighing-editor.interaction.test.tsx`

**Interfaces:**
- Consumes: `parseWeightEntry`-based `summarizeWeightEntries`, `kilogramsInputFromGrams` (Task 2). `graphQLErrorMessage` (Task 3). `useWeighLaundryOrderMutation` from `@clensy/client`. `Button`, `FormField`, `useToast` from `@clensy/ui`. `formatWeightGrams`, `useClensyTranslations` from `@clensy/web`.
- Produces: `LaundryWeighingEditor({ onRecorded, orderId, weightGrams }: LaundryWeighingEditorProps)`, where `onRecorded: () => Promise<unknown>`, `orderId: string` and `weightGrams: number | null`. Copy under `laundry.order.weighing.*`: `add`, `bag`, `combined`, `description`, `error.{blank,format,noEntries,notPositive,tooLarge,totalTooLarge}`, `failure`, `locked`, `notWeighed`, `record`, `recorded`, `remove`, `success`.

- [ ] **Step 1: Add the copy**

In `packages/web/src/i18n/messages/en/laundry.ts`, replace:

```ts
    weighing: {
      notWeighed: 'Not weighed yet.',
      recorded: 'Recorded weight',
    },
```

with:

```ts
    weighing: {
      add: 'Add bag',
      bag: 'Bag {n}',
      combined: 'Combined weight',
      description: 'Add each bag, basket, or batch. The order weight is the total.',
      error: {
        blank: 'Enter a weight.',
        format: 'Enter a weight in kilograms, up to 3 decimal places.',
        noEntries: 'Add at least one weight.',
        notPositive: 'Weight must be greater than zero.',
        tooLarge: 'Enter a smaller weight.',
        totalTooLarge: 'The combined weight is too large to record.',
      },
      failure: 'Unable to record weight.',
      locked: 'Weight is locked because this order has been priced.',
      notWeighed: 'Not weighed yet.',
      record: 'Record weight',
      recorded: 'Recorded weight',
      remove: 'Remove bag {n}',
      success: 'Weight recorded.',
    },
```

- [ ] **Step 2: Write the failing interaction tests**

Create `apps/web/lib/laundry-weighing-editor.interaction.test.tsx`:

```tsx
// @vitest-environment jsdom
import type { FetchResult } from '@apollo/client';
import type { WeighLaundryOrderMutation, WeighLaundryOrderMutationVariables } from '@clensy/client';
import { ToastProvider } from '@clensy/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// Drives the real weighing editor (#155) in jsdom with a controllable
// `weighLaundryOrder`. Typing uses the native value setter plus an
// `input` event; leaving a row dispatches `focusout`, which React's
// `onBlur` listens to. Two clicks inside one `act` both land before React
// re-renders, which is how a fast double click reaches the handler.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ORDER_ID = '3f2a9c1e-0b7d-4e55-9a10-6c2b8d4e7f01';

// What `mutate` resolves with, typed by the generated operation: Apollo
// 3.14's `FetchResult<WeighLaundryOrderMutation>` (`data` may be `null`,
// `errors` is `GraphQLFormattedError[]`). The fixtures below must satisfy
// it, so they cannot drift from the real result shape.
type WeighResult = FetchResult<WeighLaundryOrderMutation>;

// A successful weigh: the order as the `LaundryOrderDetail` fragment.
const RECORDED: WeighResult = {
  data: {
    weighLaundryOrder: {
      id: ORDER_ID,
      createdAt: '2026-10-14T09:00:00.000Z',
      customer: { id: 'c1', fullName: 'Ana Reyes' },
      fulfillmentType: 'PICKUP',
      lines: { nodes: [], pageInfo: { hasNextPage: false } },
      status: 'WEIGHED',
      totalMinorUnits: null,
      weightGrams: 2500,
    },
  },
};

const weigh = vi.hoisted(() => ({
  calls: [] as unknown[],
  reject: (() => {}) as (error: unknown) => void,
  resolve: (() => {}) as (result?: FetchResult<WeighLaundryOrderMutation>) => void,
}));

vi.mock('@clensy/client', () => ({
  useWeighLaundryOrderMutation: () => [
    (options: { variables: WeighLaundryOrderMutationVariables }) => {
      weigh.calls.push(options.variables);
      return new Promise<WeighResult>((resolve, reject) => {
        // Defaults to RECORDED (read at call time, after module init). A
        // test may resolve with GraphQL errors instead, the shape
        // `errorPolicy: 'all'` would deliver.
        weigh.resolve = (result: WeighResult = RECORDED) => resolve(result);
        weigh.reject = reject;
      });
    },
    { loading: false },
  ],
}));

let container: HTMLDivElement;
let root: Root;
let onRecorded: Mock<() => Promise<unknown>>;

async function mount(weightGrams: number | null) {
  const { LaundryWeighingEditor } = await import('../components/laundry/laundry-weighing-editor');
  act(() =>
    root.render(
      <ToastProvider>
        <LaundryWeighingEditor onRecorded={onRecorded} orderId={ORDER_ID} weightGrams={weightGrams} />
      </ToastProvider>,
    ),
  );
}

function inputs(): HTMLInputElement[] {
  return [...container.querySelectorAll<HTMLInputElement>('input')];
}

function labels(): string[] {
  return [...container.querySelectorAll('label')].map((label) => label.textContent ?? '');
}

function button(name: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((candidate) => candidate.textContent === name);
  expect(found, `button "${name}"`).toBeDefined();
  return found!;
}

function total(): string {
  return container.querySelector('[role="status"][aria-live="polite"]')?.textContent ?? '';
}

function type(index: number, text: string) {
  act(() => {
    const input = inputs()[index]!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function leave(index: number) {
  act(() => {
    inputs()[index]!.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
}

function click(name: string) {
  act(() => button(name).click());
}

function alertText(): string | null {
  return container.querySelector('[role="alert"]')?.textContent ?? null;
}

async function enterThreeBags() {
  await mount(null);
  type(0, '1.25');
  click('Add bag');
  type(1, '0.80');
  click('Add bag');
  type(2, '0.45');
}

beforeEach(() => {
  weigh.calls.length = 0;
  onRecorded = vi.fn<() => Promise<unknown>>(() => Promise.resolve());
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('laundry weighing editor', () => {
  it('starts an unweighed order with one empty, unflagged Bag 1 row and a 0.00 kg total', async () => {
    await mount(null);
    expect(labels()).toEqual(['Bag 1']);
    expect(inputs()[0]!.value).toBe('');
    expect(inputs()[0]!.getAttribute('inputmode')).toBe('decimal');
    expect(inputs()[0]!.getAttribute('aria-invalid')).toBeNull();
    expect(total()).toBe('0.00 kg');
    expect(container.textContent).toContain('Add each bag, basket, or batch. The order weight is the total.');
    expect(container.textContent).toContain('Combined weight');
  });

  it('shows the combined kilograms for three bags and records their gram sum once', async () => {
    await enterThreeBags();
    expect(labels()).toEqual(['Bag 1', 'Bag 2', 'Bag 3']);
    expect(total()).toBe('2.50 kg');
    click('Record weight');
    expect(weigh.calls).toEqual([{ input: { orderId: ORDER_ID, weightGrams: 2500 } }]);
  });

  it('updates the total at once when a row is edited or removed, and renumbers the rows', async () => {
    await enterThreeBags();
    type(1, '1');
    expect(total()).toBe('2.70 kg');
    click('Remove bag 1');
    expect(total()).toBe('1.45 kg');
    expect(labels()).toEqual(['Bag 1', 'Bag 2']);
    expect(inputs().map((input) => input.value)).toEqual(['1', '0.45']);
    expect([...container.querySelectorAll('button')].map((b) => b.textContent)).toContain('Remove bag 2');
    expect([...container.querySelectorAll('button')].map((b) => b.textContent)).not.toContain('Remove bag 3');
  });

  it.each([
    ['blank', '', 'Enter a weight.'],
    ['junk', 'abc', 'Enter a weight in kilograms, up to 3 decimal places.'],
    ['four decimals', '1.2345', 'Enter a weight in kilograms, up to 3 decimal places.'],
    ['zero', '0', 'Weight must be greater than zero.'],
    ['negative', '-1', 'Weight must be greater than zero.'],
  ])('does not submit a %s row and explains why under the input', async (_label, text, message) => {
    await mount(null);
    type(0, text);
    click('Record weight');
    expect(weigh.calls).toEqual([]);
    const input = inputs()[0]!;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    expect(container.querySelector(`#${describedBy!}`)?.textContent).toBe(message);
  });

  it('flags a row once it is left, before any submit', async () => {
    await mount(null);
    type(0, 'abc');
    expect(inputs()[0]!.getAttribute('aria-invalid')).toBeNull();
    leave(0);
    expect(inputs()[0]!.getAttribute('aria-invalid')).toBe('true');
    expect(container.textContent).toContain('Enter a weight in kilograms, up to 3 decimal places.');
  });

  it('totals the valid rows while an invalid row blocks submit', async () => {
    await mount(null);
    type(0, '1.25');
    click('Add bag');
    type(1, 'abc');
    expect(total()).toBe('1.25 kg');
    click('Record weight');
    expect(weigh.calls).toEqual([]);
  });

  it('asks for at least one weight when every row is removed', async () => {
    await mount(null);
    click('Remove bag 1');
    expect(inputs()).toEqual([]);
    expect(total()).toBe('0.00 kg');
    expect(container.querySelector('#laundry-weighing-form-error')?.textContent).toBe('Add at least one weight.');
    expect(button('Record weight').getAttribute('aria-describedby')).toBe('laundry-weighing-form-error');
    click('Record weight');
    expect(weigh.calls).toEqual([]);
  });

  it('blocks a combined weight above the GraphQL Int maximum without crashing', async () => {
    await mount(null);
    type(0, '2000000');
    click('Add bag');
    type(1, '2000000');
    expect(total()).toBe('4000000.00 kg');
    // Both rows are valid, so the total-level error is what explains the
    // block: Record weight is described by it.
    expect(inputs().every((input) => input.getAttribute('aria-invalid') === null)).toBe(true);
    const describedBy = button('Record weight').getAttribute('aria-describedby');
    expect(describedBy).toBe('laundry-weighing-form-error');
    expect(container.querySelector(`#${describedBy!}`)?.textContent).toBe('The combined weight is too large to record.');
    click('Record weight');
    expect(weigh.calls).toEqual([]);
  });

  it('flags one absurdly long row as too large instead of crashing', async () => {
    await mount(null);
    type(0, '99999999999999999999');
    leave(0);
    expect(container.textContent).toContain('Enter a smaller weight.');
    expect(total()).toBe('0.00 kg');
  });

  it('sends one mutation for a double click and disables every control while it is in flight', async () => {
    await enterThreeBags();
    act(() => {
      button('Record weight').click();
      button('Record weight').click();
    });
    expect(weigh.calls).toHaveLength(1);
    expect(inputs().every((input) => input.disabled)).toBe(true);
    expect([...container.querySelectorAll('button')].every((b) => b.disabled)).toBe(true);
    await act(async () => weigh.resolve());
    expect(inputs().every((input) => !input.disabled)).toBe(true);
    expect(weigh.calls).toHaveLength(1);
  });

  it('on success toasts, refetches the order, and leaves one row with the saved total', async () => {
    await enterThreeBags();
    click('Record weight');
    await act(async () => weigh.resolve());
    expect(container.textContent).toContain('Weight recorded.');
    expect(onRecorded).toHaveBeenCalledTimes(1);
    expect(labels()).toEqual(['Bag 1']);
    expect(inputs().map((input) => input.value)).toEqual(['2.50']);
    expect(total()).toBe('2.50 kg');
    expect(alertText()).toBeNull();
  });

  it('on failure shows the server message and keeps the rows', async () => {
    await enterThreeBags();
    click('Record weight');
    await act(async () =>
      weigh.reject({
        graphQLErrors: [
          {
            extensions: { originalError: { message: 'Cannot weigh a laundry order in status PRICED' } },
            message: 'Cannot weigh a laundry order in status PRICED',
          },
        ],
      }),
    );
    expect(alertText()).toBe('Cannot weigh a laundry order in status PRICED');
    expect(inputs().map((input) => input.value)).toEqual(['1.25', '0.80', '0.45']);
    expect(onRecorded).not.toHaveBeenCalled();
    expect(inputs().every((input) => !input.disabled)).toBe(true);
  });

  it('falls back to "Unable to record weight." without a server message', async () => {
    await enterThreeBags();
    click('Record weight');
    await act(async () => weigh.reject(new Error('Failed to fetch')));
    expect(alertText()).toBe('Unable to record weight.');
  });

  // Defense in depth: the app's effective policy is Apollo's default
  // `errorPolicy: 'none'`, which rejects (planning spike). A resolved result
  // that still carries errors, or no order, is never a success.
  it('treats a resolved result with GraphQL errors as a failure', async () => {
    await enterThreeBags();
    click('Record weight');
    await act(async () =>
      weigh.resolve({
        data: null,
        errors: [
          {
            extensions: { originalError: { message: 'Cannot weigh a laundry order in status PRICED' } },
            message: 'Cannot weigh a laundry order in status PRICED',
          },
        ],
      }),
    );
    expect(alertText()).toBe('Cannot weigh a laundry order in status PRICED');
    expect(container.textContent).not.toContain('Weight recorded.');
    expect(onRecorded).not.toHaveBeenCalled();
    expect(inputs().map((input) => input.value)).toEqual(['1.25', '0.80', '0.45']);
    expect(inputs().every((input) => !input.disabled)).toBe(true);
  });

  it('treats a resolved result without the order as a failure', async () => {
    await enterThreeBags();
    click('Record weight');
    await act(async () => weigh.resolve({ data: null }));
    expect(alertText()).toBe('Unable to record weight.');
    expect(container.textContent).not.toContain('Weight recorded.');
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it.each([
    ['editing a row', () => type(0, '1.3')],
    ['removing a row', () => click('Remove bag 3')],
    ['adding a row', () => click('Add bag')],
    // The rows are unchanged, so only the submit itself can clear it.
    ['a new submit', () => click('Record weight')],
  ])('clears a stale server error on %s', async (_label, action) => {
    await enterThreeBags();
    click('Record weight');
    await act(async () => weigh.reject(new Error('Failed to fetch')));
    expect(alertText()).toBe('Unable to record weight.');
    action();
    expect(alertText()).toBeNull();
  });

  it('keeps every control disabled until the post-save refetch settles', async () => {
    let finishRefetch: () => void = () => {};
    onRecorded = vi.fn<() => Promise<unknown>>(
      () =>
        new Promise<void>((resolve) => {
          finishRefetch = resolve;
        }),
    );
    await enterThreeBags();
    click('Record weight');
    await act(async () => weigh.resolve());
    expect(onRecorded).toHaveBeenCalledTimes(1);
    expect(inputs().every((input) => input.disabled)).toBe(true);
    expect([...container.querySelectorAll('button')].every((b) => b.disabled)).toBe(true);
    await act(async () => finishRefetch());
    expect(inputs().every((input) => !input.disabled)).toBe(true);
    expect([...container.querySelectorAll('button')].every((b) => !b.disabled)).toBe(true);
  });

  it('shows no weighing error and re-enables the form when the refetch after a save fails', async () => {
    onRecorded = vi.fn<() => Promise<unknown>>(() => Promise.reject(new Error('network')));
    await enterThreeBags();
    click('Record weight');
    await act(async () => weigh.resolve());
    expect(container.textContent).toContain('Weight recorded.');
    expect(alertText()).toBeNull();
    expect(inputs().every((input) => !input.disabled)).toBe(true);
  });

  it.each([
    [1250, '1.25'],
    [1005, '1.005'],
    [2000, '2.00'],
  ])('prefills a re-weigh of %i g with %j', async (grams, text) => {
    await mount(grams);
    expect(labels()).toEqual(['Bag 1']);
    expect(inputs()[0]!.value).toBe(text);
  });

  it('refuses to re-record a legacy 0-gram weight', async () => {
    await mount(0);
    expect(inputs()[0]!.value).toBe('0.00');
    click('Record weight');
    expect(weigh.calls).toEqual([]);
    expect(container.textContent).toContain('Weight must be greater than zero.');
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter web test -- laundry-weighing-editor`
Expected: FAIL, with "Failed to resolve import '../components/laundry/laundry-weighing-editor'".

- [ ] **Step 4: Implement the editor**

Create `apps/web/components/laundry/laundry-weighing-editor.tsx`:

```tsx
'use client';

import { useWeighLaundryOrderMutation } from '@clensy/client';
import { Button, FormField, useToast } from '@clensy/ui';
import { formatWeightGrams, useClensyTranslations } from '@clensy/web';
import { useRef, useState, type FormEvent } from 'react';
import { graphQLErrorMessage } from '../../lib/graphql-error-message';
import { kilogramsInputFromGrams, summarizeWeightEntries } from '../../lib/laundry-weight-entries';

export interface LaundryWeighingEditorProps {
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

function entry(key: number, text: string): Entry {
  return { key, text, touched: false };
}

// Several temporary weight rows summed into one `weightGrams` (lifecycle
// spec §8.4.4, #155). Rows are never persisted (§8.2): a re-weigh starts
// from one row holding the recorded total. The server stays authoritative
// (§8.4.1); this form only stops input it would reject anyway.
export function LaundryWeighingEditor({ onRecorded, orderId, weightGrams }: LaundryWeighingEditorProps) {
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
  const summary = summarizeWeightEntries(entries.map((row) => row.text));

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
    if (inFlight.current) return;
    setAttempted(true);
    setFailure(undefined);
    if (!summary.submittable) return;
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
    <form noValidate onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-3">
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
                name={`laundry-weight-entry-${String(row.key)}`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={row.text}
                error={error}
                disabled={pending}
                onChange={(event) => changeEntry(row.key, event.currentTarget.value)}
                onBlur={() => touchEntry(row.key)}
              />
            </div>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => removeEntry(row.key)}>
              {t('order.weighing.remove').replace('{n}', n)}
            </Button>
          </div>
        );
      })}
      <Button type="button" variant="secondary" disabled={pending} onClick={addEntry} className="self-start">
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
        type="submit"
        disabled={pending}
        aria-describedby={summary.formError ? FORM_ERROR_ID : undefined}
        className="w-full sm:w-auto sm:self-start"
      >
        {t('order.weighing.record')}
      </Button>
    </form>
  );
}
```

Notes for the implementer:
- **The total is a live region.** Its text changes only when the parsed total changes, so `aria-live="polite"` announces totals, not keystrokes (#155 §Accessibility).
- **Error contract:** `useWeighLaundryOrderMutation` passes no options, the generated `defaultOptions` is `{}`, and `apolloClient` sets no `defaultOptions`. Apollo 3.14's mutation `errorPolicy` is therefore `'none'`, and `mutate` rejects with an `ApolloError` carrying `graphQLErrors`. `sessionErrorLink` is an `onError` observer and does not swallow errors. The result check is defense in depth only.
- **The form error is not a second live region.** It is described from Record weight; the only `role="alert"` is the server failure.
- **`formatWeightGrams(summary.totalGrams)` cannot throw.** Each valid row is at most `MAX_WEIGHT_GRAMS`, so the sum stays a safe integer for any realistic number of rows.

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter web test -- laundry-weighing-editor`
Expected: PASS (all cases).

- [ ] **Step 6: Run the package and app checks, lint and commit**

Run: `pnpm --filter @clensy/web test && pnpm --filter @clensy/web lint && pnpm --filter @clensy/web build`
Expected: PASS. The copy change is additive; `build` is `tsc --noEmit`.

Run: `pnpm --filter web lint && pnpm --filter web exec tsc --noEmit`
Expected: no errors.

```bash
git status --short
git add packages/web/src/i18n/messages/en/laundry.ts \
  apps/web/components/laundry/laundry-weighing-editor.tsx \
  apps/web/lib/laundry-weighing-editor.interaction.test.tsx
git commit -m "feat(web): multi-entry laundry weighing editor (#155)"
```

---

### Task 5: The order page's Weighing section

**Files:**
- Modify: `apps/web/app/app/laundry/[id]/page.tsx`
- Modify: `apps/web/lib/laundry-order-page.render.test.tsx`

**Interfaces:**
- Consumes: `laundryWeighingView` (Task 3), `LaundryWeighingEditor` (Task 4), the existing `orderQuery.refetch`, `verbs`, `Fact`, `OrderSection`.
- Produces: the shipped page.

- [ ] **Step 1: Update the render-test harness**

In `apps/web/lib/laundry-order-page.render.test.tsx`:

Add the import at the top, after the `vitest` import:

```tsx
import { ToastProvider } from '@clensy/ui';
```

In the `vi.mock('@clensy/client', …)` factory, add a weigh-mutation stub after `useLaundryOrderQuery`, and give both `useLaundryOrderQuery` returns a `refetch`. Replace:

```tsx
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
```

with:

```tsx
  useLaundryOrderQuery: (options: { fetchPolicy?: string; skip?: boolean; variables?: unknown }) => {
    page.orderOptions.push(options);
    if (options.skip) return { data: undefined, error: undefined, loading: false, refetch: () => Promise.resolve() };
    return {
      data:
        page.orderRetained || (!page.orderLoading && !page.orderError) ? { laundryOrder: page.order } : undefined,
      error: page.orderError,
      loading: page.orderLoading,
      refetch: () => Promise.resolve(),
    };
  },
  // The weighing editor's mutation; never called by a static render.
  useWeighLaundryOrderMutation: () => [() => Promise.resolve({ data: {} }), { loading: false }],
}));
```

Replace `renderPage`:

```tsx
async function renderPage(): Promise<string> {
  const { default: LaundryOrderPage } = await import('../app/app/laundry/[id]/page');
  return renderToStaticMarkup(<LaundryOrderPage />);
}
```

with:

```tsx
// The app layout provides `ToastProvider`; the weighing editor needs it.
async function renderPage(): Promise<string> {
  const { default: LaundryOrderPage } = await import('../app/app/laundry/[id]/page');
  return renderToStaticMarkup(
    <ToastProvider>
      <LaundryOrderPage />
    </ToastProvider>,
  );
}
```

In `it('shows em dashes and no line list for a received order', …)`, the default role is TENANT_OWNER, who will get the editor on a `RECEIVED` order, so "Not weighed yet." no longer appears there. Replace:

```tsx
    expect(section(html, 'weighing')).toContain('Not weighed yet.');
```

with:

```tsx
    // TENANT_OWNER may weigh, so the editor replaces "Not weighed yet." (#155);
    // an unweighed order has no recorded line.
    expect(section(html, 'weighing')).not.toContain('Recorded weight');
```

The replacement holds before and after Step 4, so it is not a failing test. "Not weighed yet." stays covered by the CUSTOMER_SUPPORT, loading-role and `CANCELLED` / `REJECTED` cases below.

- [ ] **Step 2: Write the failing page tests**

Inside `describe('laundry order page', …)`, directly after the `it('shows the recorded weight, the total and the lines once priced', …)` test, add:

```tsx
  // #155: controls appear only inside Weighing; every other section stays read-only.
  it('offers the weighing editor to an operational role on a received order, and controls only there', async () => {
    page.order = order({ status: 'RECEIVED', totalMinorUnits: null, weightGrams: null });
    page.role = 'OPS_MANAGER';
    const html = await renderPage();
    const weighing = section(html, 'weighing');
    expect(weighing).toContain('<form');
    expect(weighing).toContain('Add each bag, basket, or batch. The order weight is the total.');
    expect(weighing).toContain('>Bag 1</label>');
    expect(weighing).toMatch(/inputmode="decimal"/i);
    expect(weighing).toContain('Remove bag 1');
    expect(weighing).toContain('Add bag');
    expect(weighing).toContain('Combined weight');
    // The live total, by semantics, not by class string or attribute order.
    const totalTag = /<p\b[^>]*>0\.00 kg<\/p>/.exec(weighing)?.[0];
    expect(totalTag).toBeDefined();
    expect(totalTag).toContain('role="status"');
    expect(totalTag).toContain('aria-live="polite"');
    expect(weighing).toContain('Record weight');
    expect(weighing).not.toContain('Recorded weight');
    expect(weighing).not.toContain('Weight is locked');
    const outside = html.replace(weighing, '');
    expect(outside).not.toContain('<button');
    expect(outside).not.toContain('<form');
    expect(outside).not.toContain('<input');
  });

  it('shows the recorded weight above an editor prefilled with it for a re-weigh', async () => {
    page.order = order({ status: 'WEIGHED', totalMinorUnits: null, weightGrams: 2500 });
    page.role = 'SCHEDULER';
    const html = await renderPage();
    const weighing = section(html, 'weighing');
    expect(weighing.indexOf('Recorded weight')).toBeGreaterThan(-1);
    expect(weighing.indexOf('Recorded weight')).toBeLessThan(weighing.indexOf('<form'));
    expect(weighing).toContain('2.50 kg');
    expect(weighing).toContain('value="2.50"');
  });

  it.each([
    ['CUSTOMER_SUPPORT', 'RECEIVED', null, 'Not weighed yet.'],
    ['ANALYST', 'WEIGHED', 2505, '2.505 kg'],
    [undefined, 'RECEIVED', null, 'Not weighed yet.'],
    [undefined, 'WEIGHED', 2505, '2.505 kg'],
  ])('gives %s no editor on %s', async (role, status, weightGrams, shown) => {
    page.order = order({ status, totalMinorUnits: null, weightGrams });
    page.role = role;
    const weighing = section(await renderPage(), 'weighing');
    expect(weighing).toContain(shown);
    expect(weighing).not.toContain('<form');
    expect(weighing).not.toContain('<input');
    expect(weighing).not.toContain('Record weight');
    expect(weighing).not.toContain('Add bag');
    expect(weighing).not.toContain('Weight is locked');
  });

  it.each(['TENANT_OWNER', 'ANALYST'])('locks the weight of a priced order for %s', async (role) => {
    page.order = order({ status: 'PRICED' });
    page.role = role;
    const weighing = section(await renderPage(), 'weighing');
    expect(weighing).toContain('Weight is locked because this order has been priced.');
    expect(weighing).toContain('Recorded weight');
    expect(weighing).toContain('2.505 kg');
    expect(weighing).not.toContain('<form');
    expect(weighing).not.toContain('<input');
  });

  // #155 §Submit: after a recorded weight, a failed refetch leaves the
  // order query in error (Apollo keeps the old data and sets `error`). The
  // page then shows its order error state: the weight is not reported as
  // a weighing failure, and no stale editor stays on screen.
  // Characterization test: this is the #156 error branch, unchanged.
  it('shows the order error state, not a weighing failure, when the post-save reload fails', async () => {
    page.order = order({ status: 'WEIGHED', totalMinorUnits: null, weightGrams: 2500 });
    page.role = 'OPS_MANAGER';
    page.orderRetained = true;
    page.orderError = new Error('network');
    const html = await renderPage();
    expect(html).toContain('Unable to load laundry order.');
    expect(html).toContain(BACK_LINK);
    expect(html).not.toContain('Unable to record weight.');
    expect(html).not.toContain('<form');
  });

  it.each([
    ['CANCELLED', 2505, '2.505 kg'],
    ['CANCELLED', null, 'Not weighed yet.'],
    ['REJECTED', 2505, '2.505 kg'],
    ['REJECTED', null, 'Not weighed yet.'],
  ])('never calls a %s order priced (weight %s)', async (status, weightGrams, shown) => {
    page.order = order({ status, totalMinorUnits: null, weightGrams });
    page.role = 'TENANT_OWNER';
    const weighing = section(await renderPage(), 'weighing');
    expect(weighing).toContain(shown);
    expect(weighing).not.toContain('Weight is locked');
    expect(weighing).not.toContain('<form');
  });
```

- [ ] **Step 3: Run to verify they fail**

Run: `pnpm --filter web test -- laundry-order-page.render`
Expected: FAIL. The new editor and locked tests fail because the section still shows only facts. The non-editor read-only cases, the `CANCELLED` / `REJECTED` cases and the post-save reload failure case pass already. They are **characterization tests** of the read-only body that this task keeps. Every pre-existing test still passes.

- [ ] **Step 4: Wire the section**

In `apps/web/app/app/laundry/[id]/page.tsx`:

Add the editor import after the `formatMinorUnits` import:

```tsx
import { LaundryWeighingEditor } from '../../../../components/laundry/laundry-weighing-editor';
```

Add `laundryWeighingView` to the `../../../../lib/laundry-order-page` import, keeping it alphabetical:

```tsx
import {
  LAUNDRY_ORDER_SECTIONS,
  currentLaundryOrderSection,
  laundryLifecycleVerbs,
  laundryLineQuantity,
  laundryOrderSectionId,
  laundryWeighingView,
  resolvedInvoiceNodes,
  type LaundryOrderSection,
} from '../../../../lib/laundry-order-page';
```

Update the file's header comment. Replace:

```tsx
// The order workspace (lifecycle spec §8.4.4, #156). Read-only for now:
// Weighing (#155), Services (#158), Price (#162), Invoice (#166) and
// Actions (#165) replace their section's facts with controls. The list
// still opens the drawer until the cutover (#161).
```

with:

```tsx
// The order workspace (lifecycle spec §8.4.4, #156). Weighing records a
// weight (#155). Services (#158), Price (#162), Invoice (#166) and
// Actions (#165) still show facts until their issues add controls. The
// list still opens the drawer until the cutover (#161).
```

Replace the Weighing section:

```tsx
      <OrderSection section="weighing" t={t}>
        {order.weightGrams === null ? (
          <p>{t('order.weighing.notWeighed')}</p>
        ) : (
          <Fact term={t('order.weighing.recorded')}>{formatWeightGrams(order.weightGrams)}</Fact>
        )}
      </OrderSection>
```

with:

```tsx
      <OrderSection section="weighing" t={t}>
        <WeighingBody order={order} verbs={verbs} onRecorded={() => orderQuery.refetch()} t={t} />
      </OrderSection>
```

Add this component directly after `OverviewBody`:

```tsx
// #155, owner decision 1 (M4): the editor for an actor who may weigh; the
// locked sentence, with the weight, for a priced order; otherwise the
// recorded weight or "Not weighed yet.". The recorded line is the server
// value, so it changes only after a save's refetch.
function WeighingBody({
  onRecorded,
  order,
  t,
  verbs,
}: {
  onRecorded: () => Promise<unknown>;
  order: LaundryOrderDetail;
  t: Translate;
  verbs: readonly LaundryOrderVerb[];
}) {
  const view = laundryWeighingView(order.status, verbs);
  const recorded =
    order.weightGrams === null ? null : (
      <Fact term={t('order.weighing.recorded')}>{formatWeightGrams(order.weightGrams)}</Fact>
    );
  if (view === 'readOnly') return recorded ?? <p>{t('order.weighing.notWeighed')}</p>;
  if (view === 'locked') {
    return (
      <div className="flex flex-col gap-3">
        <p>{t('order.weighing.locked')}</p>
        {recorded}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {recorded}
      <LaundryWeighingEditor onRecorded={onRecorded} orderId={order.id} weightGrams={order.weightGrams} />
    </div>
  );
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `pnpm --filter web test -- laundry-order-page`
Expected: PASS. That covers `laundry-order-page.test`, `laundry-order-page.render` (every earlier case unchanged, plus the new ones) and nothing else matched.

- [ ] **Step 6: Run the app suite, lint, type-check and commit**

Run: `pnpm --filter web test && pnpm --filter web lint && pnpm --filter web exec tsc --noEmit`
Expected: all pass. The suite has 37 files: 34 plus `laundry-weight-entries`, `graphql-error-message` and `laundry-weighing-editor.interaction`.

```bash
git status --short
git add apps/web/app/app/laundry/[id]/page.tsx apps/web/lib/laundry-order-page.render.test.tsx
git commit -m "feat(web): record laundry weights from the order page (#155)"
```

---

### Task 6: Final verification

**Files:** none changed, unless a check fails. A failure stops the task: fix it in the task that owns the code, re-run that task's checks, then come back.

- [ ] **Step 1: Run every check**

```bash
pnpm --filter api test
pnpm --filter api lint
pnpm --filter api test:e2e -- laundry.e2e-spec laundry.service.e2e-spec
pnpm --filter @clensy/web test
pnpm --filter @clensy/web lint
pnpm --filter @clensy/web build
pnpm --filter web test
pnpm --filter web lint
pnpm --filter web exec tsc --noEmit
pnpm --filter web build
```

Expected: all pass. `pnpm --filter web build` still lists `/app/laundry/[id]`. Record each command's result in the M6 Slice Completion Report's Validation table, one row per command, marked PASS, FAIL or **NOT RUN** with the reason. Never fold an unrun command into another row.

The report MUST also state:
- **Server-side enforcement:** authorization and status enforcement for `weighLaundryOrder` stay server-side and unchanged (resolver roles, the status check in `LaundryOrdersService.weigh`). The UI gate is presentation only.
- **API tests:** whether the API unit tests and the two laundry e2e suites actually ran.
- **Exclusions:** the release-gate and tenant-isolation e2e suites are **not run, by design**. No resolver, role, query or tenant scope changed, and no probe weighs `0` (planning spike). The report must say these suites were excluded, not that other checks covered them.

- [ ] **Step 2: Check it in the browser**

Start the app with the API and web dev servers as in earlier laundry slices. Sign in as TENANT_OWNER and open a `RECEIVED` order at `/app/laundry/<id>`. Then confirm:

1. **Entry and total:** enter `1.25`, Add bag, `0.80`, Add bag, `0.45`. The total reads `2.50 kg`. Record weight shows the toast "Weight recorded.". The summary's Weight card and "Recorded weight" both read `2.50 kg`, the status badge reads "Weighed", and the editor shows one row `2.50`. The editor stays mounted during the refetch (no loading flash).
2. **Errors and blocked submit:** enter `abc` and tab away. The inline error shows and Record weight does not send. Check the network tab for no `weighLaundryOrder` request.
3. **Mobile width:** at 375 px, each row stacks its input and Remove button, Record weight is full width, and nothing scrolls horizontally.
4. **Locked view:** price the order, using the drawer on `/app/laundry`. The order page's Weighing section then shows the locked sentence and the weight, with no form.
5. **CUSTOMER_SUPPORT:** sign in as CUSTOMER_SUPPORT and open a `RECEIVED` order. The section shows "Not weighed yet." and no form.

Record what was checked in the M6 report.

---

## Traceability

| Requirement | Source | Task |
| --- | --- | --- |
| `weightGrams ≥ 1` on input and service; stored zeros untouched; CHECK unchanged | §8.4.1; owner decision 2 | 1 |
| Rows summed in whole grams, ≤ 3 decimals, no float multiply | §8.4.4; #155 §Calculation | 2 |
| Blank / junk / 4-decimal / zero / negative rejected inline; no submit | §8.4.1 (UI half); #155 §Validation | 2, 4 |
| Live combined total, valid rows only, announced politely | #155 §Calculation, §Accessibility | 4 |
| One mutation; double click sends one; controls disabled in flight | #155 §Submit, acceptance | 4 |
| Success toast, refetch, prefilled saved total; failure alert keeps rows | #155 §Submit; issue comment 2 (refetch) | 4, 5 |
| Re-weigh prefill; WEIGHED stays state-preserving (server) | §4.4; #155 §Re-weigh | 4 |
| Editor only with `weigh` (RECEIVED/WEIGHED ∩ OPERATIONAL) | §4.4; #155 §When it shows | 3, 5 |
| Locked copy only for priced statuses; never CANCELLED/REJECTED | §4.5; owner decision 1 | 3, 5 |
| No bag persistence; mutation input unchanged | §8.2, §8.6 | all (no schema/operation change) |
| Replace the section body; narrow the "no controls" assertion | Issue comment 2 | 5 |
| Nav current-section rule unchanged | #156 M4 owner decision 2; issue comment 2 | — (not edited) |

## Deferred / out of scope

- **The list drawer (`apps/web/app/app/laundry/page.tsx`)** keeps its single `Math.round(Number(kg) * 1000)` field until #161 removes the drawer (#156 Global Constraints). With Task 1, a `0` entered there is now rejected by the server. Its other float behavior is not fixed here.
- Persisting bag rows; pricing; changing the nav's current-section rule; the `?detail=` redirect (#161).
- A localized decimal separator (`1,5`): rejected as a format error, per the issue's character rule.

## Execution risks

- **The API e2e suite needs the local test Postgres.** If it is unavailable, record Task 1 Step 7 and Task 6's e2e line as **NOT RUN** with the reason. Do not mark them passed.
- **jsdom `focusout`:** React 19 attaches `onBlur` to `focusout`. If the `leave` helper does not trigger it, use `input.focus()` and then `input.blur()` inside `act`. Do not change the component.
- **Lint ordering rules** (`contextforge/record-key-order`, `sort-type-constituents`) may ask for key or member reordering in new literals. Reorder only. Fold the change into the task's commit.

---

## Execution record

### M6 — Implementation complete (2026-10-14)

Executed **subagent-driven** (owner's choice) from `4fd6732`, in plan order, one commit per task. A fresh implementer subagent ran each task from its extracted brief, and a fresh task reviewer checked spec compliance and quality before the next task started. Every task review returned **Approved** on the first pass, with no Critical or Important finding, so there were no fix rounds.

| Task | Commit | Implementer / reviewer | Review |
| --- | --- | --- | --- |
| 1 API minimum | `0463178` | Sonnet / Sonnet | Approved |
| 2 Entry parsing | `1acecb7` | Haiku / Sonnet | Approved |
| 3 View and error text | `f89b01d` | Haiku / Sonnet | Approved |
| 4 Editor | `71ac3bc` | Sonnet / Sonnet | Approved |
| 5 Page | `65bde38` | Sonnet / Sonnet | Approved |

**TDD evidence.** Each task's new tests failed first, for the planned reason:
- **Task 1:** 2 failed and 75 passed. The service test failed with "Received promise resolved instead of rejected" (zero was accepted). The DTO test `rejects zero with the min constraint` got `[]`. The other three DTO cases passed as characterization.
- **Task 2:** "Cannot find module './laundry-weight-entries'".
- **Task 3:** the view tests failed with "not iterable", because the spread export was undefined at collection time. This wording differs from the brief; the cause is the same, a missing export.
- **Task 4:** "Failed to resolve import '../components/laundry/laundry-weighing-editor'".
- **Task 5:** 4 render tests failed: editor, re-weigh, and locked for two roles.

**Deviations from the plan text:** none. Every task applied its code verbatim, and no lint reorders were needed.

**Minor findings, deferred to M7 triage.** Task reviewers raised these as non-blocking:
- **Task 1:** the older negative and non-integer service tests don't assert the pre-transaction boundary. The zero test covers the shared guard.
- **Task 2:**
  - `kilogramsInputFromGrams` strips `/ kg$/` from `formatWeightGrams`. This is plan-mandated, and a round-trip test guards it.
  - The cases `-.5`, `1.000`, `9999999` and a summary with a `tooLarge` row are untested. All of them behave correctly.
- **Task 3:** `graphQLErrorMessage` shows only the first validation message.
- **Task 4:**
  - Focus falls to `body` while every control is disabled in flight.
  - The prefill is initial state only. This is safe: `page.tsx` keys `LaundryOrderWorkspace` by `id`.
  - The `weigh.resolve`/`reject` helpers are not reset in `beforeEach`.
- **Task 5:** the static render tests stub `refetch`. The browser check below exercises the real refetch.

**Validation (Task 6, Step 1).** Run at `65bde38`:

| Command | Result |
| --- | --- |
| `pnpm --filter api test` | **PASS**, 75 suites, 1071 tests |
| `pnpm --filter api lint` | **PASS** |
| `pnpm --filter api test:e2e -- laundry.e2e-spec laundry.service.e2e-spec` | **PASS**, 2 suites, 12 tests, against the local Postgres |
| `pnpm --filter @clensy/web test` | **PASS**, 15 files, 411 tests |
| `pnpm --filter @clensy/web lint` | **PASS** |
| `pnpm --filter @clensy/web build` | **PASS** |
| `pnpm --filter web test` | **PASS**, 37 files, 962 tests (831 at `c6b6c75`; +131) |
| `pnpm --filter web lint` | **PASS** |
| `pnpm --filter web exec tsc --noEmit` | **PASS** |
| `pnpm --filter web build` | **PASS**; the route list shows `ƒ /app/laundry/[id]` |

- **Server-side enforcement.** Authorization and status enforcement for `weighLaundryOrder` stay server-side and unchanged: the resolver roles and the `RECEIVED`/`WEIGHED` check in `LaundryOrdersService.weigh`. This slice only raises the minimum to 1, in the DTO and in the service. The UI gate is presentation only.
- **API tests.** The API unit suite and both laundry e2e suites ran, and all of them passed.
- **Exclusions.** The release-gate and tenant-isolation e2e suites were **not run, by design**. No resolver, role, query or tenant scope changed, and no probe weighs `0`. They were excluded, not covered by the checks above.

**Manual browser check (Task 6, Step 2).**
- **Setup.** This follows the #156 and #160 precedent, on other ports, because something already listening on 3010 was not started by this session and was left alone. This branch's API was built and run on 3020 (`WEB_ORIGIN=http://localhost:3021`). This branch's web ran as a production build on 3021 (`NEXT_PUBLIC_API_URL=http://localhost:3020/graphql`), against the local Postgres. The Docker containers were untouched.
- **Accounts.** The local database had no usable owner login, so the documented `pnpm --filter api db:seed` ran. It refreshed the booking fixtures and created `owner@clensy.local`. Throwaway `qa155-owner-…@example.com` (TENANT_OWNER) and `qa155-support-…@example.com` (CUSTOMER_SUPPORT) accounts were created with `createAdmin` and disabled afterwards with `disableAdmin`.
- **Data.** Two `RECEIVED` orders were created with `receiveLaundryOrder`. They remain in the local dev data.
- **Tooling.** Driven with Playwright. The screenshot is `.playwright-mcp/155-weighing-mobile.png` (gitignored).

| # | Viewport, role | Result |
| --- | --- | --- |
| 1 | 1280 px, TENANT_OWNER | `RECEIVED` order. Entering `1.25`, Add bag, `0.80`, Add bag, `0.45` showed a live total of `2.50 kg`. Record weight showed the toast "Weight recorded." The header badge became "Weighed", the summary Weight read `2.50 kg`, and "Recorded weight 2.50 kg" appeared. The editor showed one row, `2.50`. The server returned `WEIGHED`, 2500 g. A MutationObserver showed the editor node was never removed during the refetch (no loading flash). **Pass** |
| 2 | 1280 px, TENANT_OWNER | Typing `abc` and pressing Tab set `aria-invalid="true"`. The described-by text was "Enter a weight in kilograms, up to 3 decimal places." Record weight sent no `WeighLaundryOrder` request (fetch counter 0, and the network list unchanged) and raised no alert. **Pass** |
| 3 | 375 px, TENANT_OWNER | Two rows. Each input (312 px) sits above its Remove button (312 px). Record weight is 312 px, the full content width. The document scroll width is 360, within 375, so there is no horizontal scroll. **Pass** |
| 4 | 1280 px, TENANT_OWNER | The order was priced through `priceLaundryOrder`, not through the `/app/laundry` drawer. This is the same mutation, run from the command line, and it returned `PRICED`, ₱50.00. The Weighing section then read "Weight is locked because this order has been priced. / Recorded weight / 2.50 kg", with no input, button or form. **Pass** |
| 5 | 1280 px, CUSTOMER_SUPPORT | Second `RECEIVED` order. The Weighing section read "Not weighed yet." and `main` had no input, form or button. **Pass** |

The console showed only the existing favicon 404.

## Slice Completion Report

| Field | Result |
| --- | --- |
| Slice | #155 Multi-entry laundry weighing |
| Tracking | https://github.com/rexescario-dev/clensy-platform/issues/155 |
| M4 | Plan **Accepted** |
| M5 | Review **Accepted** |
| M6 | **Complete** |
| M7 | Pending |
| M8 | Pending |
| M9 | Pending |
| Branch | `feat/155-multi-entry-laundry-weighing` |
| PR | https://github.com/rexescario-dev/clensy-platform/pull/185 (opened after M7–M9) |
| Status | **Ready for M7** |

### Shipped

- The server rejects a zero weight on the GraphQL input (`@Min(1)`) and in `LaundryOrdersService.weigh`, before any transaction (§8.4.1). The database CHECK is unchanged.
- On `/app/laundry/<id>`, staff with the `weigh` action can enter several bag, basket or batch weights in kilograms and see a live combined total. One weight is recorded in whole grams, with no float arithmetic.
- Inline validation covers blank, non-numeric, more than 3 decimals, zero or negative, and above the GraphQL `Int` maximum. An invalid row blocks submit.
- There is one mutation per submit. Controls stay disabled until the save and the refetch settle. A success toast appears, and the editor re-prefills with the saved total. A failure alert keeps the rows.
- Priced orders show "Weight is locked because this order has been priced." to every role. `CANCELLED` and `REJECTED` never show it. Other roles and statuses see the read-only weight or "Not weighed yet."

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

### M7 — Approved for merge (2026-10-14, fresh independent review)

`CLAUDE.md` requires a fresh agent on the most capable model for application code, so this review was done by one (Opus 5.5) that did not implement the change. It was read-only. It was given the Accepted spec, this plan and the branch diff (`c6b6c75..ff06c61`, code only). **This is not a self-review.** Its record, condensed:

```text
Decision: Approved for merge
Subject: branch feat/155-multi-entry-laundry-weighing (from main c6b6c75); code commits
  0463178, 1acecb7, f89b01d, 71ac3bc, 65bde38; plan/record commits 8848ec9…4fd6732, ff06c61
Accepted specification: docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md
  (Amendment #164 §8.4.1, §8.4.4; §8.2, §4.3, §4.4, §4.5, §4.7)
Accepted implementation plan: this plan, revision 8 (M5 accept recorded at 4fd6732)
M6 gate: 4fd6732 at 22:44:33 precedes the first code commit 0463178 at 22:47:23.

Plan tasks reviewed:
- Task 1: ✓ @Min(1); the service guard sits before dataSource.transaction; CHECK and migrations untouched;
  the zero test asserts no transaction/findOne/update/audit; DTO spec; GraphQL e2e leaves RECEIVED/null.
- Task 2: ✓ both files byte-identical to the plan (checked with diff).
- Task 3: ✓ graphql-error-message files byte-identical; the laundry-order-page append matches;
  currentLaundryOrderSection unchanged.
- Task 4: ✓ editor and interaction test byte-identical; copy block matches.
- Task 5: ✓ import, header comment, section replacement, WeighingBody and render-test edits match.
- Task 6: ✓ all ten commands recorded PASS; enforcement, API-test and exclusion statements present;
  five browser items pass (item 4 priced via the same mutation from the CLI, disclosed; accepted).

Verification evidence:
- M6 record (TDD red runs, Task 6 table, browser check).
- Reviewer re-ran read-only: npx vitest run on the 5 slice test files → 5 files, 210 tests passed;
  pnpm --filter api test -- laundry-orders.service laundry-order.inputs → 2 suites, 77 passed.

Review summary: a faithful, near-verbatim realization of revision 8, with no deviations.
- §8.4.1 holds on both layers (the DTO and a pre-transaction service guard; NaN is rejected by
  Number.isInteger); stored zeros and the CHECK are untouched.
- §8.4.4 holds: integer grams by string split, at most 3 decimals, one mutation, no bag data (§8.2).
- The priced set was checked against the §4.3 matrix: all 11 statuses are reachable only via
  WEIGHED→PRICED; CANCELLED/REJECTED are excluded and pinned by tests.
- Examined: the in-flight ref is set before any await; pending covers the mutation and the refetch;
  a refetch rejection is swallowed; finally always clears; a resolved error or missing order is a
  failure. Parsing order, the 7-digit whole cap and safe totals were traced by hand.
- Hidden scope: none. The list page, currentLaundryOrderSection, @clensy/ui, client operation
  documents, schema and migrations are untouched; no dependency changed.

Blocking findings: None (no merge blockers)

Non-blocking observations:
- Focus is not restored to Record weight after a submit settles (an a11y follow-up; the plan did
  not require focus handling).
- graphQLErrorMessage shows only the first ValidationPipe constraint; for this input there is at most one.
- The editor's interaction test lives in apps/web/lib/, per the plan's file map and harness precedent.
- Cosmetic: reset weigh.resolve/reject in beforeEach; add boundary assertions to the older
  negative/non-integer service tests.

Deferred-minor triage: all eight M6 task-review minors may stay deferred (each traced or covered).

Gate: Merge per human/project norms. M8/M9 may follow.
```

### M8 — N/A (2026-10-14)

```text
Decision: N/A
Subject: branch feat/155-multi-entry-laundry-weighing, head ff06c61
Accepted specification: docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md (Amendment #164 §8.4.1, §8.4.4)
Accepted implementation plan: this plan (revision 8)
M7: Approved for merge.
Candidates considered, and why none is an M8 refactor:
- Focus restore after submit, and showing more than one validation message, each change behavior.
  They are follow-up candidates, not refactors.
- Test hygiene (resetting the weigh helpers; boundary assertions on the older service tests) is
  cosmetic. M7 found no stale-helper dependence, and the shared guard is already pinned.
- Moving the editor's interaction test beside the component would break the apps/web/lib test-harness
  convention the plan follows.
- The code is byte-identical to the Accepted plan; no duplication or complexity is worth the churn.
No code changed in M8.
```

### M9 — Complete (2026-10-14)

```text
Decision: Complete
Subject: #155 Multi-entry laundry weighing
Accepted specification: docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md (with Amendment #164)
Accepted implementation plan: this plan (revision 8)
M7: Approved for merge. M8: N/A.
Documentation scope:
- apps/web/README.md
- packages/web/README.md
- docs/README.md
- this plan (Status row, the M7–M10 records)
Updated artifacts:
- apps/web/README.md ← M6 Tasks 2–5: the order page is no longer described as wholly read-only.
  A new Weighing bullet covers the three views (editor, locked, read-only), the explicit priced set
  excluding CANCELLED/REJECTED, integer-gram parsing, the Int cap, one mutation, controls disabled
  through the refetch, the failure text and the re-weigh prefill.
  #155 is removed from the "replace those bodies" list.
- packages/web/README.md ← M6 Task 4: the laundry intro names #155's editor and plan; the copy
  bullet describes the new `order.weighing` keys.
- docs/README.md ← M6 Task 1: a new "Positive laundry weight (#155)" section, after #159 in
  chronological order. It covers the @Min(1) input, the pre-transaction service check and message,
  that roles/status/input are unchanged, no migration (CHECK stays >= 0, stored zeros untouched),
  and that the release-gate and tenant-isolation suites were not changed.
Editorial changes: none beyond the above.
Unchanged, with reason:
- README.md (root) describes ck_laundry_order_weight_non_negative as >= 0, which stays true.
- The lifecycle spec: #155 implements Amendment #164 §8.4.1/§8.4.4 without amending it
  (the #156/#157/#160 precedent).
- No changelog or roadmap file exists in the repository.
Verification:
- Links: every relative link and in-page anchor in the three READMEs and this plan resolves
  (scripted scan, 75 checked, 0 broken).
- Heading hierarchy: the new docs/README.md `##` follows #159; the apps/web bullet sits inside the
  existing order-page `##`; the packages/web changes sit inside the existing laundry `##`.
- Status consistency: plan Accepted (revision 8); M6 complete; M7 Approved; M8 N/A; M9 complete.
- Terminology follows the spec and plan: weighing editor, locked, read-only, priced set, re-weigh.
Gate: Documentation complete. Code, behavior and contracts are unchanged by this stage.
```

**PR CI.** [Run 38587103196](https://github.com/rexescario-dev/clensy-platform/actions/runs/38587103196) on PR #185 passed all four jobs: Lint, Test, Release gate and API e2e. The release-gate and tenant-isolation suites were left out of the local Task 6 run by design. They ran in CI as part of the standard pipeline, and they passed.

### M10 — Accepted, workflow validated (2026-10-14)

```text
Decision: Accepted
Subject: workflow prompt library
Governing specification: docs/workflows/specs/agent-workflow-design.md
```

**Subject.** The installed workflow prompt library (`docs/workflows/`) was run on #155 from M4 to M9.
- There was no M2 or M3, because #155 implements Amendment #164 §8.4.1 and §8.4.4, which were already Accepted (#167).
- The Context Forge dispatch asked for "Brainstorm (project default)", but the workflow's selection rule governed: an Accepted spec exists, so the work starts at M4. This is the #156 precedent.
- Two decisions were put to the owner at M4 and recorded in the plan header: when the locked copy shows, and the CHECK and reviewer choice.

**Asset inventory.** Unchanged. There are no orphan assets, and `docs/workflows/` was not edited.

**Checks:**
- **§2.5 gate:** the M5 accept of revision 8 (recorded in `4fd6732`, 22:44:33) precedes the first M6 commit, `0463178` (22:47:23).
- **M5 Return path:** M5 ran in five parts, then re-checked parts 3 and 4.
  - Every finding was named and resolved by a numbered plan revision (2–8), each logged in the M5 history row.
  - No Accepted text was rewritten silently.
  - Revisions 7 and 8 added executed pre-validation where the reviewer asked for proof rather than prose.
- **Authority model:**
  - The spec governed semantics: the server minimum of 1, integer-gram summing, and re-weigh only in `RECEIVED` and `WEIGHED`.
  - The owner decisions sit within §4.5 and §8.4.1.
  - The plan governed sequencing: Tasks 1–6 ran in order, one commit per code task, with code transcribed verbatim. M7 confirmed this byte for byte.
- **M7 independence:** `CLAUDE.md`'s rule was honored. The reviewer was a fresh agent on the most capable model, worked read-only, and was given the spec, the plan and the diff.
- **Providers:** GitHub was used for issues #155, #154 and #164, the branch, and PR #185, all through `gh`. The GitHub MCP server failed to connect, and nothing fell back to it.
- **Reporting:** Slice Completion Reports were emitted at M6 and in the closing report below. The M7–M10 records are here.
- **§2.8:** one PR (#185) carries the plan, its M5 record, the implementation and the docs.
- **Attribution:** no commit on the branch carries a `Co-Authored-By` trailer or a "Generated with" line, and the PR body has none. This is the owner's global rule.

**Blocking findings:** none.

**Non-blocking observations:**
1. **Executed pre-validation shortened M5.** Applying Tasks 2–4 verbatim at revision 8 and running tests, lint and `tsc` turned two reviewer requests for proof into evidence. It also caught a lint rule (`record-key-order`) and a script slip before M6. In M6, Tasks 2–4 then needed no adaptation.
2. **Subagent-driven M6 with per-task reviewers found no defects, only minors.** Most of the value came from the plan's verbatim code. Per-task review cost about 5 dispatches. A single native pass plus the mandatory M7 would likely have reached the same result for a plan this complete.
3. **Local environment.**
   - The local database had no usable owner login, so the documented `db:seed` was needed.
   - Port 3010 was held by a process this session did not start.
   - Running on 3020 and 3021 worked and left everything else untouched.
   - Recording "which ports and which accounts" in the M6 record keeps the next slice from rediscovering this.
4. **Local exclusion and CI coverage are different claims.** The plan required the local report to list release-gate and tenant-isolation as excluded. CI then ran them. Both facts are recorded separately, so neither is overstated.

Gate: **Workflow validated.**

### Owner-directed follow-ups (post-M7)

On 2026-10-14 the owner asked to "fix the follow-ups within the PR". These are the three non-blocking M7 observations that change code or tests. The other two need no code change: the first-message-only error text and the test-file location. The work was done in this session from `9e32311`, with TDD:

| Follow-up | Commit | Change |
| --- | --- | --- |
| Focus is not restored after a submit | `3384c52` | `LaundryWeighingEditor` refs the form and Record weight. An effect runs only on the `pending` true→false transition, after the save and its refetch settle, and focuses Record weight when focus is nowhere, on `body`, or still inside the form. Focus the user moved elsewhere is left alone. |
| Weigh test helpers are not reset | `3384c52` | `beforeEach` sets `weigh.resolve`/`reject` to a function that throws "No weighLaundryOrder call is in flight." |
| Older service tests are weaker than the zero test | `66bb124` | The negative, zero and non-integer cases are now one `it.each`. Each asserts the exact message and that no transaction, `findOne`, update or audit runs. |

**Evidence:**
- **RED, the focus tests.** The two focus-return tests failed with "expected body to be button". jsdom neither moves focus off a newly disabled button nor blurs a disabled one, so the tests stand in for the browser fixup: they park focus on a throwaway input, then remove it. The "leaves focus where the user moved it" test passed before the fix, as characterization. Changing the effect's condition to `if (true)` made it fail.
- **Mutation, the service tests.** Temporarily changing the service message failed all three `it.each` cases. Before this change, the negative and non-integer cases asserted only the exception type.
- **The suite runs:**

  | Command | Result |
  | --- | --- |
  | `pnpm --filter api test` | 1071 passed |
  | `pnpm --filter api lint` | clean |
  | `pnpm --filter web test` | 37 files, 965 passed (+3) |
  | `pnpm --filter web lint` | clean |
  | `pnpm --filter web exec tsc --noEmit` | clean |
  | `pnpm --filter web build` | clean |

  The first `tsc` run failed on the helper-reset typing. It was fixed before the commit.
- **The browser run.** This branch ran on 3020/3021, as in the browser check above, with a throwaway `qa155-owner2-…` TENANT_OWNER that was disabled afterwards. The steps:
  1. Type `1.5`.
  2. Focus Record weight.
  3. Press Enter.

  The log read `disabled:Record weight` and then `enabled:body`, so Chromium dropped focus. After the save and refetch settled, `document.activeElement` was Record weight again. The second `RECEIVED` order is now `WEIGHED` at 1500 g in the local dev data.

**M7 re-review: Approved for merge.** A fresh, independent agent on the most capable model (Opus 5.5) did this review, as `CLAUDE.md` requires for an application-code change. It did not write the change. It reviewed the delta `9e32311..3384c52` and re-ran the editor interaction test (32 passed), the service spec (73 passed) and `tsc` (clean). **This is not a self-review.**

Condensed findings:
- The effect never fires on mount, and is a no-op under StrictMode's double-run.
- Focus lands in the same commit that re-enables the button.
- An unmount during the refetch focuses nothing.
- `ref` reaches the native `<button>` through `@clensy/ui`'s `Button`.
- The `beforeEach` reset is loud.
- The `it.each` keeps and strengthens the three earlier tests.
- No scope beyond the follow-ups.

Blocking findings: none. Non-blocking:
- A "no focus change on mount" test would be optional hardening.
- On a failed save, focus could move to a problem row in a future a11y pass.
- The jsdom parking workaround can go if a real-browser component test runner is adopted.

**Docs:** `apps/web/README.md`'s Weighing bullet now mentions the focus return.

## Slice Completion Report (final)

| Field | Result |
| --- | --- |
| Slice | #155 Multi-entry laundry weighing |
| Tracking | https://github.com/rexescario-dev/clensy-platform/issues/155 |
| M4 | Plan **Accepted** |
| M5 | Review **Accepted** |
| M6 | **Complete** |
| M7 | **Approved** |
| M8 | N/A |
| M9 | **Complete** |
| Branch | `feat/155-multi-entry-laundry-weighing` |
| PR | https://github.com/rexescario-dev/clensy-platform/pull/185 |
| Status | **Ready for merge** |

### Shipped

- The server rejects a zero weight on the GraphQL input and in the service, before any transaction. There is no migration, and stored zeros are untouched.
- A multi-row weighing editor on the order page records one total in whole grams, with inline validation and a live total. Focus returns to Record weight after a save settles (owner-directed follow-up).
- The editor sends one mutation per submit. Controls stay disabled through the save and the refetch. Success shows a toast and the saved total; failure keeps the rows and shows the server message.
- Locked copy appears only for priced statuses, and never for `CANCELLED` or `REJECTED`. Every other case is read-only.
- The READMEs document the editor, the copy and the API change.

### Validation

| Check | Result |
| --- | --- |
| Tests | **Passed** |
| Typecheck | **Passed** |
| Lint | **Passed** |
| Build | **Passed** |
| Package validation | N/A |

### Next Gate

None. The slice is complete pending merge under the owner's norms.
