# Laundry UI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Accepted |
| M5 decision | **Accepted** — 2026-10-10, at `92d6fca`, by the owner, on the third pass, with no further revision. All four second-pass findings are resolved: scope check, `COMPLETED` progress contract, full ordered progress paths, and the API-source comparison. M6 MUST implement Tasks 1–6 as written, within the Final verification allowlist (no API, `@clensy/ui`, client or page change). That includes Task 4 Step 3's oracle script, all mutation and negative checks, and the scope check's negative case. M7 MUST be a fresh independent review (`CLAUDE.md`: application code). |
| M5 history | First pass (2026-10-10, owner): **Returned for Revision** with five P1 and three P2 findings. All eight are applied in this revision. **P1:** (1, 3, 7) progress now maps every status through one exhaustive record. A mismatched status/fulfillment pair still shows the recorded status as the single current step. `AWAITING_PAYMENT` is labeled and announced as the current "Awaiting payment" step, never as a completed Paid step, with before/after-payment coverage for both fulfillment types (Task 5). (2) Every verb is reconciled against the API source (Reconciliation section), and an API-shaped oracle checks all 210 status × fulfillment × role combinations (Task 4). **P2:** (4) the weight formatter's contract is written down, with boundary cases up to `Number.MAX_SAFE_INTEGER` (Task 3). (5) the baseline test is confirmed against the unchanged page (Task 1). (6) a changed-file allowlist replaces the forbidden-path diff (Final verification). (8) table-driven accessibility assertions cover every status and both fulfillment types (Task 5). The whole plan was re-pre-validated (Pre-validation). Second pass (2026-10-10, owner): **Returned for Revision** with two P1 and two P2 findings, applied here. **P1:** (1) the scope check is an explicit `if`/`else` that ends in `false`, with a recorded negative case. The earlier `&& { …; exit 1; } || echo` form did exit 1 when run as a script, because `exit` in a brace group ends the shell before `||` runs. But it would close an interactive terminal, and it was hard to read. (2) `COMPLETED` now has one contract: every step is done, none is current, and there is no `aria-current`. The component sets `aria-current` from `state === 'current'`, matching the pure helper. **P2:** (3) every consistent status × fulfillment pair asserts the full ordered sequence against written-out paths, and the named cases assert full step lists. The mismatched pairs stay separate. (4) the API comparison is now a required, repeatable Task 4 step, a script that exits 1 on any difference, with recorded results and negative checks on both the oracle and the helper. |
| Date | 2026-10-10 |
| Tracking issue | [#157](https://github.com/rexescario-dev/clensy-platform/issues/157). Epic [#154](https://github.com/rexescario-dev/clensy-platform/issues/154). |
| Scope | `packages/web` (new `laundry` i18n namespace, new `src/laundry/` module, `index.ts` exports) and two `apps/web/lib` tests. No `apps/api`, no `packages/ui`, no `packages/client`, no page or route change. |
| Implements (Accepted) | [Laundry Orders & Lifecycle](../specs/2026-09-06-laundry-orders-lifecycle-design.md), Status **Accepted** (2026-09-06), with **Amendment #164**, Accepted 2026-10-10 (M3; merged in #167 at `7c59b82`). The relevant sections are §4.3 (matrix), §4.4 (verb RBAC), §4.9 (status tones, action set = matrix ∩ fulfillment branch ∩ role), and §8.4.4 (order workspace: human-readable labels, kilograms from integer grams, presentation-only action mirror, explicit confirmation for destructive verbs). |
| Relies on (Accepted) | [Laundry Invoices](../specs/2026-09-06-laundry-invoices-design.md): the generation roles (FINANCE, TENANT_OWNER) and the eligible status range. [Single App-Level `ClensyI18nProvider`](../specs/2026-10-02-single-app-i18n-provider-design.md): `@clensy/web` owns the default catalog and apps/web layers overrides. |
| Authority | Where this plan and an Accepted spec disagree, the **spec wins** and this plan must be revised. File names, helper names, key names, verb identifiers, copy wording, and task order are planning decisions, not product semantics. |
| Edit anchors | Every edit is located by the **quoted code**, not by line number. Branch base: `7c59b82` (`main`). |

**Goal:** Give the #154 laundry screens one shared presentation layer, so later issues do not each reinvent status labels, weight display, role-aware action visibility, or progress display. Nothing user-visible changes in this slice. The current `/app/laundry` page is untouched, and a characterization test pins what it renders today.

**Architecture:**

- **Where it lives.** Everything new goes in `@clensy/web`. That is where the issue puts the catalog, it follows the `bookings` precedent (component + catalog + tests in one package), and the package's Vitest already renders with `ClensyI18nProvider`. It is laundry-local: nothing is added to `@clensy/ui`. As with `AdminRole`, identifiers are declared locally so `@clensy/web` does not depend on `@clensy/client`. An apps/web test pins them to the generated client types (Task 6).
- **Copy (Task 2).** `messages/en/laundry.ts`, registered in `getDefaultMessages()`. Enum-valued maps (`status`, `fulfillment`, `invoicePaymentStatus`, `paymentTerms`, `progress.terminal`) are keyed by the GraphQL enum value, so a screen calls `t(`status.${status}`)` without a mapping table. Verb maps (`actions`, `success`, `failure`, `confirm`) are keyed by `LaundryOrderVerb`. `confirm` uses the plain-language sentences from #165. `useClensyTranslations` has no interpolation, so per-verb strings are spelled out.
- **Status and weight (Task 3).** `LaundryOrderStatus` / `LaundryFulfillmentType` unions, `LAUNDRY_STATUS_TONE` (the §4.9 map, unchanged), `LAUNDRY_ORDER_STATUSES`, and `formatWeightGrams`. The formatter's contract: the input is a non-negative safe integer number of grams, and anything else throws `RangeError`. The output is `<whole kg>.<fraction> kg`, where the fraction is the three gram digits with one trailing zero dropped, so it always has two or three digits. Integer arithmetic only, so nothing rounds. Money stays `formatMinorUnits` in `apps/web/lib/format-price.ts`.
- **Actions (Task 4).** `laundryOrderActions(status, fulfillmentType, role)` returns the verbs a screen may show: the §4.3 matrix mirror (plus the §4.4 re-weigh of `WEIGHED`) ∩ the fulfillment branch ∩ the resolver role sets, in one presentation order. It is reconciled verb by verb against the API source (Reconciliation). The test checks all 210 combinations against an oracle written in the API's own shapes: the target matrix, per-mutation role lists, and service preconditions. It also exports `canReceiveLaundryOrder(role)`, because intake is not order-scoped. `generateInvoice` is legal on the invoice spec's eligible range. Whether an invoice already exists is left to the screen. A missing role (still loading) sees nothing.
- **Progress (Task 5).** `laundryProgressSteps` (pure) and `<LaundryOrderProgress>`. It renders an ordered list with `aria-current="step"` and a screen-reader state per step. Every status is mapped once, in an exhaustive `Record<LaundryOrderStatus, …>`, so a new status fails to compile:

  | Status | Progress |
  | --- | --- |
  | `RECEIVED`, `WEIGHED`, `PRICED` | current at slots 1–3 |
  | `AWAITING_PAYMENT` | current at slot 4, labeled "Awaiting payment". `PRICED` is done, and Paid is not shown. |
  | `PAID` | current at slot 4, labeled "Paid" |
  | `PROCESSING`, `READY` | current at slots 5–6. The slot-4 Paid step is done. |
  | `AWAITING_PICKUP`, `AWAITING_DELIVERY` | current at slot 7. That slot shows the status itself, so a status that disagrees with `fulfillmentType` (which the server never writes) still has exactly one current step. |
  | `COMPLETED` | every step done, none current, no `aria-current` |
  | `CANCELLED`, `REJECTED`, `LOST`, `DAMAGED`, `REFUNDED` | no steps: `StatusBadge` plus one sentence |

  Before `READY`, slot 7 follows `fulfillmentType`.
- **Feedback (deliverable 4).** No component. The catalog provides `success` (toast) and `failure` (inline `role="alert"`) copy per verb, and `confirm` copy for exactly the destructive verbs. The rules for consuming screens are in Global Constraints.

**Tech Stack:** React 19, `@clensy/ui` (`StatusBadge`, `StatusTone`), `@clensy/web` i18n (`useClensyTranslations`, `ClensyI18nProvider`), Vitest 5 in the `node` environment with `react-dom/server` `renderToStaticMarkup`, and `expectTypeOf` type assertions checked by `tsc --noEmit`. No new dependency and no new test runner.

**Pre-validation (full; re-run for each M5 revision).** On 2026-10-10 the code was applied to a working tree at `7c59b82`. The plan's code blocks are generated from those exact files, and the `index.ts` exports follow this plan's task order. Each RED state was reproduced by removing that task's implementation module while keeping its test. Every command named by an `Expected:` line ran with the stated result. The tree was then reverted. Commands run:

- `pnpm --filter web exec vitest run lib/laundry-page-baseline.test.tsx`: 1 passed (characterization, green on first run)
- `pnpm --filter @clensy/web exec vitest run src/laundry/format-weight-grams.test.ts`: RED (`Cannot find module './format-weight-grams'`), then GREEN 17 passed
- `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-order-actions.test.ts`: RED (`Cannot find module './laundry-order-actions'`), then GREEN 228 passed.
- `node "$TMPDIR/check-laundry-oracle.mjs"` (Task 4 Step 3): all 10 checks `ok`, `ORACLE: matches API source`, exit 0. Negative checks: an oracle `PAID` row with an extra `CANCELLED` gave `ORACLE: 1 difference(s)`, exit 1. `refundLaundryOrder` transcribed with `CANCEL` gave 1 difference. Helper mutations under the 210-combination test: `REFUND` widened with `SCHEDULER` gave 18 failed / 210 passed, and `PAID` gaining `cancel` gave 6 failed / 222 passed. Everything was restored and re-ran green.
- `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-order-progress.test.tsx`: RED (`Cannot find module './laundry-order-progress'`), then GREEN 68 passed. Mutation checks (Task 5 Step 3a): dropping the status-follows-return-slot rule gave 2 failed / 66 passed. Swapping `PROCESSING` and `READY` in the path gave 44 failed / 24 passed. Setting `aria-current` from `step.status === status` again (the earlier `COMPLETED` conflict) gave 2 failed / 66 passed. Each was restored and 68 passed.
- `pnpm --filter web exec vitest run lib/laundry-presentation-contract.test.ts`: 2 passed. Mutation check: removing `VOID` from `invoicePaymentStatus` made `pnpm --filter web exec tsc --noEmit` report 1 error, and restoring it cleared the error.
- `pnpm --filter @clensy/web test` (11 files, 376 tests passed), `pnpm --filter @clensy/web build` (tsc, exit 0), `pnpm --filter @clensy/web lint` (exit 0)
- `pnpm --filter web test` (24 files, 595 tests passed), `pnpm --filter web exec tsc --noEmit` (exit 0), `pnpm --filter web lint` (exit 0), `pnpm --filter web build` (exit 0)
- The Final verification scope check printed `SCOPE: ok` with status 0. With a stray `packages/ui/src/stray.ts`, it printed `SCOPE: unexpected files:` and the file, returned status 1, and did not print `SCOPE: ok`.

## Global Constraints

Derived from the Accepted spec and amendment only. Every task's requirements implicitly include this section.

- Status badge tones are exactly the §4.9 map. Status is never conveyed by color alone: the badge text is the label.
- The action helper is the intersection of the §4.3 matrix, the fulfillment branch (`AWAITING_PICKUP` only for `PICKUP`, `AWAITING_DELIVERY` only for `DELIVERY`), and the role sets as implemented in `laundry-order.resolver.ts` and `invoice.resolver.ts`. Do not widen any set. `ANALYST` and `SUPER_ADMIN` get no verbs. It is presentation only, and the server stays authoritative (§4.9, §8.4.4).
- The client matrix is a mirror, not a second state machine. It adds nothing the server policy does not allow. The only non-transition entries are the §4.4 re-weigh (`weigh` on `WEIGHED`) and `price` on `WEIGHED`.
- Weight is displayed from integer grams with integer arithmetic only. A 1-gram weight must not render as `0.00 kg` (§8.4.4: "kilograms rendered from integer grams").
- `AWAITING_PAYMENT` is a branch, not a required step. It is shown and announced as the current "Awaiting payment" step, never as a completed Paid step. Every non-terminal status other than `COMPLETED`, including a status/fulfillment pair that disagrees, renders exactly one current step (`aria-current="step"`). `COMPLETED` renders every step as done with no current step. Terminal exceptions never render the happy path as complete.
- Progress steps are never interactive: no buttons or links.
- `@clensy/web` must not import `@clensy/client`.
- Consuming screens (#155–#166), recorded here so they do not drift: success → `useToast().success(t(`success.${verb}`))`; a failure stays inline (`role="alert"`), with the server message when present and otherwise `t(`failure.${verb}`)`; never toast and inline the same error; destructive verbs (`LAUNDRY_DESTRUCTIVE_VERBS`) go through `ConfirmDialog` with `t(`confirm.${verb}`)` and `t(`actions.${verb}`)` as the confirm label; disable the submitting control while a mutation is in flight. No consumer forks a second status map.

## Review Focus

1. **Reconciliation.** The table below and Task 4's oracle are transcriptions of the API source. The 210-combination test only proves the helper agrees with the oracle. Task 4 Step 3's script proves the oracle agrees with the API source. Both must pass before Task 4 is committed.
2. **Progress mapping.** Task 5 asserts the state of every step for all 15 statuses × both fulfillment types, plus the mismatched pairs.
3. **Type pin.** Task 6's `expectTypeOf` assertions are checked by `tsc`, not by Vitest at runtime. The mutation check proves they bite.

## Reconciliation (API source at `7c59b82`)

Role constants, from `apps/api/src/modules/laundry/presentation/graphql/laundry-order.resolver.ts`:

- OPERATIONAL = TENANT_OWNER, OPS_MANAGER, SCHEDULER
- INTAKE = OPERATIONAL + CUSTOMER_SUPPORT
- PAYMENT = TENANT_OWNER, OPS_MANAGER, FINANCE, CUSTOMER_SUPPORT
- CANCEL = TENANT_OWNER, OPS_MANAGER, CUSTOMER_SUPPORT
- EXCEPTION = TENANT_OWNER, OPS_MANAGER
- REFUND = TENANT_OWNER, OPS_MANAGER, FINANCE

`AuthGuard` admits a principal only when its role is listed, with no `SUPER_ADMIN` bypass. So `ANALYST` and `SUPER_ADMIN` get no verbs.

| Verb | API mutation | `@Roles` | Legal when (source) |
| --- | --- | --- | --- |
| `weigh` | `weighLaundryOrder` | OPERATIONAL | status `RECEIVED` (→ `WEIGHED`) or `WEIGHED` (re-weigh) — `LaundryOrdersService.weigh` |
| `price` | `priceLaundryOrder` | OPERATIONAL | status `WEIGHED` — `LaundryOrdersService.price` |
| `markAwaitingPayment` | `markLaundryOrderAwaitingPayment` | PAYMENT | policy allows → `AWAITING_PAYMENT` (`PRICED`) |
| `markPaid` | `markLaundryOrderPaid` | PAYMENT | → `PAID` (`PRICED`, `AWAITING_PAYMENT`) |
| `startProcessing` | `startLaundryProcessing` | OPERATIONAL | → `PROCESSING` (`PAID`) |
| `markReady` | `markLaundryOrderReady` | OPERATIONAL | → `READY` (`PROCESSING`) |
| `markAwaitingPickup` | `markLaundryOrderAwaitingPickup` | OPERATIONAL | → `AWAITING_PICKUP` (`READY`), and only for `PICKUP` (§4.3) |
| `markAwaitingDelivery` | `markLaundryOrderAwaitingDelivery` | OPERATIONAL | → `AWAITING_DELIVERY` (`READY`), and only for `DELIVERY` (§4.3) |
| `complete` | `completeLaundryOrder` | INTAKE | → `COMPLETED` (`AWAITING_PICKUP`, `AWAITING_DELIVERY`) |
| `generateInvoice` | `generateInvoiceFromOrder` | FINANCE, TENANT_OWNER (`invoice.resolver.ts`) | priced and not `CANCELLED`/`REJECTED`/`LOST`/`DAMAGED`/`REFUNDED`, i.e. `PRICED`..`COMPLETED` — `InvoicesService.assertEligible`. "Already invoiced" is the screen's check. |
| `cancel` | `cancelLaundryOrder` | CANCEL | → `CANCELLED` (`RECEIVED`, `WEIGHED`, `PRICED`, `AWAITING_PAYMENT`) |
| `reject` | `rejectLaundryOrder` | EXCEPTION | → `REJECTED` (`RECEIVED`, `WEIGHED`) |
| `markLost` | `markLaundryOrderLost` | EXCEPTION | → `LOST` (`PROCESSING`, `READY`, `AWAITING_PICKUP`, `AWAITING_DELIVERY`) |
| `markDamaged` | `markLaundryOrderDamaged` | EXCEPTION | → `DAMAGED` (same as lost) |
| `refund` | `refundLaundryOrder` | REFUND | → `REFUNDED` (`PAID`, `PROCESSING`, `READY`, `AWAITING_PICKUP`, `AWAITING_DELIVERY`, `COMPLETED`, `LOST`, `DAMAGED`) |
| *(intake)* `canReceiveLaundryOrder` | `receiveLaundryOrder` | INTAKE | not order-scoped |

---

## File Map

| File | Change | Task |
| --- | --- | --- |
| `apps/web/lib/laundry-page-baseline.test.tsx` | Create (characterization) | 1 |
| `packages/web/src/i18n/messages/en/laundry.ts` | Create | 2 |
| `packages/web/src/i18n/messages.ts` | Modify: register `laundry` | 2 |
| `packages/web/src/laundry/laundry-order-status.ts` | Create | 3 |
| `packages/web/src/laundry/format-weight-grams.ts` / `.test.ts` | Create | 3 |
| `packages/web/src/laundry/laundry-order-actions.ts` / `.test.ts` | Create | 4 |
| `packages/web/src/laundry/laundry-order-progress.tsx` / `.test.tsx` | Create | 5 |
| `packages/web/src/index.ts` | Modify: public exports | 3, 4, 5 |
| `apps/web/lib/laundry-presentation-contract.test.ts` | Create | 6 |

---

### Task 1: Baseline characterization of today's list (issue deliverable 6)

**Files:** Create `apps/web/lib/laundry-page-baseline.test.tsx`

This is a **characterization test**. It pins the current behavior, so it is green on first run. It renders the real `app/app/laundry/page.tsx` with mocked `@clensy/client` hooks and `next/navigation`. Raw enum labels and the 2-decimal weight are today's behavior, not a target. #163 updates this test when it replaces the list.

The mock lists exactly the 22 hooks `page.tsx` imports from `@clensy/client` at `7c59b82`. The page needs no provider for its list path: `useDetailDrawer` only reads `next/navigation`, and the drawer is not rendered without `?detail=`. If the page later imports a hook the mock lacks, Vitest fails with `No "<name>" export is defined on the mock`, which names it. The assertions cover only the list cells.

- [ ] **Step 1: Write the test**

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Characterization (#157): pins what today's `/app/laundry` list renders,
// before #163 replaces it, so later issues can show the delta. It is not a
// target: raw enum labels and the 2-decimal weight are today's behavior.
const order = {
  id: 'o1',
  createdAt: '2026-10-01T09:00:00.000Z',
  customer: { id: 'c1', fullName: 'Ana Reyes' },
  fulfillmentType: 'DELIVERY',
  status: 'AWAITING_PAYMENT',
  totalMinorUnits: 45000,
  weightGrams: 2500,
};

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/laundry',
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@clensy/client', () => {
  const idle = () => [vi.fn(), { loading: false }];
  const query = () => ({ data: undefined, error: undefined, loading: false, refetch: vi.fn() });
  return {
    useCancelLaundryOrderMutation: idle,
    useCompleteLaundryOrderMutation: idle,
    useCurrentAdminQuery: query,
    useCustomersQuery: () => ({ data: { customers: { nodes: [] } } }),
    useGenerateInvoiceFromOrderMutation: idle,
    useInvoiceForOrderQuery: query,
    useLaundryOrderQuery: query,
    useLaundryOrdersQuery: () => ({
      data: { laundryOrders: { nodes: [order], totalCount: 1 } },
      error: undefined,
      loading: false,
      refetch: vi.fn(),
    }),
    useMarkLaundryOrderAwaitingDeliveryMutation: idle,
    useMarkLaundryOrderAwaitingPaymentMutation: idle,
    useMarkLaundryOrderAwaitingPickupMutation: idle,
    useMarkLaundryOrderDamagedMutation: idle,
    useMarkLaundryOrderLostMutation: idle,
    useMarkLaundryOrderPaidMutation: idle,
    useMarkLaundryOrderReadyMutation: idle,
    usePriceLaundryOrderMutation: idle,
    useReceiveLaundryOrderMutation: idle,
    useRefundLaundryOrderMutation: idle,
    useRejectLaundryOrderMutation: idle,
    useServicesQuery: query,
    useStartLaundryProcessingMutation: idle,
    useWeighLaundryOrderMutation: idle,
  };
});

describe('/app/laundry list (baseline characterization)', () => {
  it('shows customer, raw status and fulfillment, weight and total for each order', async () => {
    const { default: LaundryPage } = await import('../app/app/laundry/page');
    const html = renderToStaticMarkup(<LaundryPage />);
    expect(html).toContain('Ana Reyes');
    expect(html).toContain('AWAITING_PAYMENT');
    expect(html).toContain('DELIVERY');
    expect(html).toContain('2.50 kg');
    expect(html).toContain('₱450.00');
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm --filter web exec vitest run lib/laundry-page-baseline.test.tsx`
Expected: 1 passed.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/laundry-page-baseline.test.tsx
git commit -m "test(web): characterize the current laundry list before the redesign (#157)"
```

### Task 2: Laundry copy catalog (issue deliverable 1; spec §4.9, §8.4.4)

**Files:** Create `packages/web/src/i18n/messages/en/laundry.ts`. Modify `packages/web/src/i18n/messages.ts`.

The tests for this copy are in Tasks 4 and 5 (every verb has a label, success and failure string; confirm copy covers exactly the destructive verbs; every status and terminal status has a label or sentence) and Task 6 (the enum-keyed maps equal the generated unions).

- [ ] **Step 1: Create the catalog**

```ts
// Default `en` copy for laundry screens (#154). Keys under `status`,
// `fulfillment`, `invoicePaymentStatus`, `paymentTerms` and
// `progress.terminal` are the GraphQL enum values, so a screen resolves
// `t(`status.${order.status}`)` with no mapping table. Verb keys match
// `LaundryOrderVerb` in `laundry/laundry-order-actions.ts`.
export const laundry = {
  actions: {
    cancel: 'Cancel order',
    complete: 'Complete order',
    generateInvoice: 'Generate invoice',
    markAwaitingDelivery: 'Mark awaiting delivery',
    markAwaitingPayment: 'Mark awaiting payment',
    markAwaitingPickup: 'Mark awaiting pickup',
    markDamaged: 'Mark damaged',
    markLost: 'Mark lost',
    markPaid: 'Mark paid',
    markReady: 'Mark ready',
    price: 'Confirm price',
    refund: 'Refund order',
    reject: 'Reject order',
    startProcessing: 'Start processing',
    weigh: 'Record weight',
  },
  confirm: {
    cancel: 'Cancel this order? It will be called off before payment. This cannot be undone.',
    markDamaged: 'Mark this order damaged? This cannot be undone.',
    markLost: 'Mark this order lost? This cannot be undone.',
    refund: "Refund this order? This records that the order's collected payment is returned. This cannot be undone.",
    reject: 'Reject this order? The shop is refusing it at intake. This cannot be undone.',
  },
  empty: 'No laundry orders.',
  error: {
    list: 'Unable to load laundry orders.',
    order: 'Unable to load laundry order.',
  },
  failure: {
    cancel: 'Unable to cancel the order.',
    complete: 'Unable to complete the order.',
    generateInvoice: 'Unable to generate the invoice.',
    markAwaitingDelivery: 'Unable to mark the order awaiting delivery.',
    markAwaitingPayment: 'Unable to mark the order awaiting payment.',
    markAwaitingPickup: 'Unable to mark the order awaiting pickup.',
    markDamaged: 'Unable to mark the order damaged.',
    markLost: 'Unable to mark the order lost.',
    markPaid: 'Unable to mark the order paid.',
    markReady: 'Unable to mark the order ready.',
    price: 'Unable to confirm the price.',
    refund: 'Unable to refund the order.',
    reject: 'Unable to reject the order.',
    startProcessing: 'Unable to start processing.',
    weigh: 'Unable to record the weight.',
  },
  fulfillment: {
    DELIVERY: 'Delivery',
    PICKUP: 'Customer pickup',
  },
  invoicePaymentStatus: {
    PAID: 'Paid',
    PARTIALLY_PAID: 'Partially paid',
    UNPAID: 'Unpaid',
    VOID: 'Void',
  },
  noActions: 'No further actions for this order.',
  paymentTerms: {
    PAY_NOW: 'Pay now',
    PAY_ON_COMPLETION: 'Pay on completion',
    PAY_ON_DELIVERY: 'Pay on delivery',
  },
  progress: {
    label: 'Order progress',
    state: {
      complete: 'Done',
      current: 'Current step',
      upcoming: 'Not started',
    },
    terminal: {
      CANCELLED: 'This order was cancelled before payment.',
      DAMAGED: 'This order was marked damaged.',
      LOST: 'This order was marked lost.',
      REFUNDED: "This order's collected payment was returned.",
      REJECTED: 'The shop refused this order at intake.',
    },
  },
  status: {
    AWAITING_DELIVERY: 'Awaiting delivery',
    AWAITING_PAYMENT: 'Awaiting payment',
    AWAITING_PICKUP: 'Awaiting pickup',
    CANCELLED: 'Cancelled',
    COMPLETED: 'Completed',
    DAMAGED: 'Damaged',
    LOST: 'Lost',
    PAID: 'Paid',
    PRICED: 'Priced',
    PROCESSING: 'Processing',
    READY: 'Ready',
    RECEIVED: 'Received',
    REFUNDED: 'Refunded',
    REJECTED: 'Rejected',
    WEIGHED: 'Weighed',
  },
  success: {
    cancel: 'Order cancelled.',
    complete: 'Order completed.',
    generateInvoice: 'Invoice generated.',
    markAwaitingDelivery: 'Order marked awaiting delivery.',
    markAwaitingPayment: 'Order marked awaiting payment.',
    markAwaitingPickup: 'Order marked awaiting pickup.',
    markDamaged: 'Order marked damaged.',
    markLost: 'Order marked lost.',
    markPaid: 'Order marked paid.',
    markReady: 'Order marked ready.',
    price: 'Price confirmed.',
    refund: 'Order refunded.',
    reject: 'Order rejected.',
    startProcessing: 'Processing started.',
    weigh: 'Weight recorded.',
  },
};
```

- [ ] **Step 2: Register the namespace** in `packages/web/src/i18n/messages.ts`

After `import { bookings } from './messages/en/bookings';` add:

```ts
import { laundry } from './messages/en/laundry';
```

Replace `return { auth, bookings, roles, staff };` with:

```ts
  return { auth, bookings, laundry, roles, staff };
```

- [ ] **Step 3: Verify nothing else moved**

Run: `pnpm --filter @clensy/web build && pnpm --filter @clensy/web test`
Expected: tsc exit 0. The existing 8 files pass.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/i18n/messages/en/laundry.ts packages/web/src/i18n/messages.ts
git commit -m "feat(web): add the laundry message catalog (#157)"
```

### Task 3: Status identifiers, tones and the weight formatter (issue deliverables 1–2; spec §4.9, §8.4.4)

**Files:** Create `packages/web/src/laundry/laundry-order-status.ts`, `format-weight-grams.ts`, and `format-weight-grams.test.ts`. Modify `packages/web/src/index.ts`.

- [ ] **Step 1: Write the failing formatter test**

```ts
import { describe, expect, it } from 'vitest';
import { formatWeightGrams } from './format-weight-grams';

describe('formatWeightGrams', () => {
  it.each([
    [0, '0.00 kg'],
    [1, '0.001 kg'],
    [10, '0.01 kg'],
    [100, '0.10 kg'],
    [101, '0.101 kg'],
    [110, '0.11 kg'],
    [999, '0.999 kg'],
    [1000, '1.00 kg'],
    [1005, '1.005 kg'],
    [1250, '1.25 kg'],
    [2500, '2.50 kg'],
    [Number.MAX_SAFE_INTEGER, '9007199254740.991 kg'],
  ])('renders %i g as %s', (grams, expected) => {
    expect(formatWeightGrams(grams)).toBe(expected);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])('rejects %s', (grams) => {
    expect(() => formatWeightGrams(grams)).toThrow(RangeError);
  });
});
```

Run: `pnpm --filter @clensy/web exec vitest run src/laundry/format-weight-grams.test.ts`
Expected: FAIL. `Cannot find module './format-weight-grams'`.

- [ ] **Step 2: Implement**

`packages/web/src/laundry/laundry-order-status.ts`:

```ts
import type { StatusTone } from '@clensy/ui';

// Stable laundry identifiers, declared locally (not imported from
// @clensy/client) to keep @clensy/web free of the GraphQL client — the
// `AdminRole` precedent. apps/web pins them to the generated client types
// (`apps/web/lib/laundry-presentation-contract.test.ts`).
export type LaundryOrderStatus =
  | 'AWAITING_DELIVERY'
  | 'AWAITING_PAYMENT'
  | 'AWAITING_PICKUP'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'DAMAGED'
  | 'LOST'
  | 'PAID'
  | 'PRICED'
  | 'PROCESSING'
  | 'READY'
  | 'RECEIVED'
  | 'REFUNDED'
  | 'REJECTED'
  | 'WEIGHED';

export type LaundryFulfillmentType = 'DELIVERY' | 'PICKUP';

// Accepted lifecycle spec §4.9 badge tones.
export const LAUNDRY_STATUS_TONE: Readonly<Record<LaundryOrderStatus, StatusTone>> = {
  AWAITING_DELIVERY: 'warning',
  AWAITING_PAYMENT: 'neutral',
  AWAITING_PICKUP: 'warning',
  CANCELLED: 'danger',
  COMPLETED: 'success',
  DAMAGED: 'danger',
  LOST: 'danger',
  PAID: 'warning',
  PRICED: 'neutral',
  PROCESSING: 'warning',
  READY: 'warning',
  RECEIVED: 'neutral',
  REFUNDED: 'danger',
  REJECTED: 'danger',
  WEIGHED: 'neutral',
};

export const LAUNDRY_ORDER_STATUSES = Object.keys(LAUNDRY_STATUS_TONE) as readonly LaundryOrderStatus[];
```

`packages/web/src/laundry/format-weight-grams.ts`:

```ts
// Integer grams → kilograms for display. Contract:
// - input: a non-negative safe integer number of grams; anything else
//   throws `RangeError` (`null` "not weighed" is the caller's to render);
// - output: `<kg>.<fraction> kg`, where `<kg>` is the whole kilograms with
//   no grouping and `<fraction>` is the three gram digits with one trailing
//   zero dropped, so it is always two or three digits:
//   1000 → 1.00 kg, 1250 → 1.25 kg, 1005 → 1.005 kg, 1 → 0.001 kg;
// - integer arithmetic only, so no value rounds: 1 g never renders as
//   0.00 kg, and the largest safe integer renders exactly.
// Money stays `formatMinorUnits` in apps/web.
export function formatWeightGrams(grams: number): string {
  if (!Number.isSafeInteger(grams) || grams < 0) {
    throw new RangeError(`weight must be a non-negative integer number of grams, got ${grams}`);
  }
  const remainder = grams % 1000;
  const kilograms = (grams - remainder) / 1000;
  const fraction = String(remainder).padStart(3, '0');
  const decimals = fraction.endsWith('0') ? fraction.slice(0, 2) : fraction;
  return `${kilograms}.${decimals} kg`;
}
```

Append to `packages/web/src/index.ts`:

```ts

export { LAUNDRY_ORDER_STATUSES, LAUNDRY_STATUS_TONE } from './laundry/laundry-order-status';
export type { LaundryFulfillmentType, LaundryOrderStatus } from './laundry/laundry-order-status';
export { formatWeightGrams } from './laundry/format-weight-grams';
```

- [ ] **Step 3: Run**

Run: `pnpm --filter @clensy/web exec vitest run src/laundry/format-weight-grams.test.ts`
Expected: 17 passed.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/laundry/laundry-order-status.ts packages/web/src/laundry/format-weight-grams.ts packages/web/src/laundry/format-weight-grams.test.ts packages/web/src/index.ts
git commit -m "feat(web): add laundry status tones and an integer-safe weight formatter (#157)"
```

### Task 4: Role- and transition-aware action helper (issue deliverable 3; spec §4.3, §4.4, §4.9, §8.4.4)

**Files:** Create `packages/web/src/laundry/laundry-order-actions.ts` and `laundry-order-actions.test.ts`. Modify `packages/web/src/index.ts`.

- [ ] **Step 1: Write the failing test**

It has three layers: (a) the API-shaped oracle, transcribed from the sources in the Reconciliation table, checked against the helper for all 15 statuses × 2 fulfillment types × 7 roles; (b) the issue's and #165's named examples, as readable pins; (c) the copy-completeness checks for every verb.

```ts
import { describe, expect, it } from 'vitest';
import { ADMIN_ROLES } from '../roles/admin-roles';
import { getDefaultMessages } from '../i18n/messages';
import {
  LAUNDRY_DESTRUCTIVE_VERBS,
  LAUNDRY_ORDER_VERBS,
  canReceiveLaundryOrder,
  laundryOrderActions,
} from './laundry-order-actions';
import { LAUNDRY_ORDER_STATUSES, type LaundryOrderStatus } from './laundry-order-status';
import type { LaundryOrderVerb } from './laundry-order-actions';
import type { AdminRole } from '../roles/admin-roles';

// Reconciliation oracle (#157 M5). An independent transcription of the API,
// in the API's own shapes, so a slip in the helper's verb-keyed tables shows
// up as a disagreement. Sources, at 7c59b82:
// - SERVER_MATRIX: `MATRIX` in
//   apps/api/src/modules/laundry/domain/laundry-order-status-transition-policy.ts
// - MUTATIONS: each mutation's `@Roles(...)` in
//   apps/api/src/modules/laundry/presentation/graphql/laundry-order.resolver.ts
//   (OPERATIONAL, INTAKE, PAYMENT, CANCEL, EXCEPTION, REFUND constants), and
//   `generateInvoiceFromOrder`'s in
//   apps/api/src/modules/billing/presentation/graphql/invoice.resolver.ts
// - legal: the transition target via SERVER_MATRIX; `weighLaundryOrder` and
//   `priceLaundryOrder` status checks in LaundryOrdersService.weigh / .price;
//   `assertEligible` + `EXCLUDED_STATUSES` in InvoicesService.
const SERVER_MATRIX: Record<LaundryOrderStatus, LaundryOrderStatus[]> = {
  AWAITING_DELIVERY: ['COMPLETED', 'LOST', 'DAMAGED', 'REFUNDED'],
  AWAITING_PAYMENT: ['PAID', 'CANCELLED'],
  AWAITING_PICKUP: ['COMPLETED', 'LOST', 'DAMAGED', 'REFUNDED'],
  CANCELLED: [],
  COMPLETED: ['REFUNDED'],
  DAMAGED: ['REFUNDED'],
  LOST: ['REFUNDED'],
  PAID: ['PROCESSING', 'REFUNDED'],
  PRICED: ['AWAITING_PAYMENT', 'PAID', 'CANCELLED'],
  PROCESSING: ['READY', 'LOST', 'DAMAGED', 'REFUNDED'],
  READY: ['AWAITING_PICKUP', 'AWAITING_DELIVERY', 'LOST', 'DAMAGED', 'REFUNDED'],
  RECEIVED: ['WEIGHED', 'REJECTED', 'CANCELLED'],
  REFUNDED: [],
  REJECTED: [],
  WEIGHED: ['PRICED', 'REJECTED', 'CANCELLED'],
};
const OPERATIONAL: AdminRole[] = ['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER'];
const INTAKE: AdminRole[] = [...OPERATIONAL, 'CUSTOMER_SUPPORT'];
const PAYMENT: AdminRole[] = ['TENANT_OWNER', 'OPS_MANAGER', 'FINANCE', 'CUSTOMER_SUPPORT'];
const CANCEL: AdminRole[] = ['TENANT_OWNER', 'OPS_MANAGER', 'CUSTOMER_SUPPORT'];
const EXCEPTION: AdminRole[] = ['TENANT_OWNER', 'OPS_MANAGER'];
const REFUND: AdminRole[] = ['TENANT_OWNER', 'OPS_MANAGER', 'FINANCE'];
const PRICED_ONWARD: LaundryOrderStatus[] = [
  'PRICED', 'AWAITING_PAYMENT', 'PAID', 'PROCESSING', 'READY', 'AWAITING_PICKUP', 'AWAITING_DELIVERY', 'COMPLETED',
  'CANCELLED', 'LOST', 'DAMAGED', 'REFUNDED',
];
const INVOICE_EXCLUDED: LaundryOrderStatus[] = ['CANCELLED', 'REJECTED', 'LOST', 'DAMAGED', 'REFUNDED'];
const byTarget = (target: LaundryOrderStatus) => (s: LaundryOrderStatus) => SERVER_MATRIX[s].includes(target);
const MUTATIONS: Record<string, { legal: (s: LaundryOrderStatus) => boolean; roles: AdminRole[]; verb: LaundryOrderVerb }> = {
  cancelLaundryOrder: { legal: byTarget('CANCELLED'), roles: CANCEL, verb: 'cancel' },
  completeLaundryOrder: { legal: byTarget('COMPLETED'), roles: INTAKE, verb: 'complete' },
  generateInvoiceFromOrder: {
    legal: (s) => PRICED_ONWARD.includes(s) && !INVOICE_EXCLUDED.includes(s),
    roles: ['FINANCE', 'TENANT_OWNER'],
    verb: 'generateInvoice',
  },
  markLaundryOrderAwaitingDelivery: { legal: byTarget('AWAITING_DELIVERY'), roles: OPERATIONAL, verb: 'markAwaitingDelivery' },
  markLaundryOrderAwaitingPayment: { legal: byTarget('AWAITING_PAYMENT'), roles: PAYMENT, verb: 'markAwaitingPayment' },
  markLaundryOrderAwaitingPickup: { legal: byTarget('AWAITING_PICKUP'), roles: OPERATIONAL, verb: 'markAwaitingPickup' },
  markLaundryOrderDamaged: { legal: byTarget('DAMAGED'), roles: EXCEPTION, verb: 'markDamaged' },
  markLaundryOrderLost: { legal: byTarget('LOST'), roles: EXCEPTION, verb: 'markLost' },
  markLaundryOrderPaid: { legal: byTarget('PAID'), roles: PAYMENT, verb: 'markPaid' },
  markLaundryOrderReady: { legal: byTarget('READY'), roles: OPERATIONAL, verb: 'markReady' },
  priceLaundryOrder: { legal: (s) => s === 'WEIGHED', roles: OPERATIONAL, verb: 'price' },
  refundLaundryOrder: { legal: byTarget('REFUNDED'), roles: REFUND, verb: 'refund' },
  rejectLaundryOrder: { legal: byTarget('REJECTED'), roles: EXCEPTION, verb: 'reject' },
  startLaundryProcessing: { legal: byTarget('PROCESSING'), roles: OPERATIONAL, verb: 'startProcessing' },
  weighLaundryOrder: { legal: (s) => s === 'RECEIVED' || s === 'WEIGHED', roles: OPERATIONAL, verb: 'weigh' },
};
// The fulfillment branch: the server picks the READY target from
// `fulfillmentType` (lifecycle spec §4.3); the UI offers only that one.
const BRANCH_ONLY: Partial<Record<LaundryOrderVerb, 'DELIVERY' | 'PICKUP'>> = {
  markAwaitingDelivery: 'DELIVERY',
  markAwaitingPickup: 'PICKUP',
};

describe('laundryOrderActions', () => {
  it('covers every order-scoped mutation the API has, and no other verb', () => {
    expect(Object.values(MUTATIONS).map((m) => m.verb).sort()).toEqual([...LAUNDRY_ORDER_VERBS].sort());
  });

  const combos = LAUNDRY_ORDER_STATUSES.flatMap((status) =>
    (['DELIVERY', 'PICKUP'] as const).flatMap((fulfillment) =>
      [...ADMIN_ROLES].map((role) => [status, fulfillment, role] as const),
    ),
  );

  it.each(combos)('%s + %s + %s matches the API oracle, in presentation order', (status, fulfillment, role) => {
    const expected = LAUNDRY_ORDER_VERBS.filter((verb) => {
      const mutation = Object.values(MUTATIONS).find((m) => m.verb === verb);
      if (!mutation || !mutation.legal(status) || !mutation.roles.includes(role)) return false;
      const branch = BRANCH_ONLY[verb];
      return branch === undefined || branch === fulfillment;
    });
    expect(laundryOrderActions(status, fulfillment, role)).toEqual(expected);
  });

  it.each([
    // #157 issue table and #165 role examples.
    ['RECEIVED', 'PICKUP', 'OPS_MANAGER', ['weigh', 'cancel', 'reject']],
    ['RECEIVED', 'PICKUP', 'CUSTOMER_SUPPORT', ['cancel']],
    ['WEIGHED', 'PICKUP', 'SCHEDULER', ['weigh', 'price']],
    ['PRICED', 'PICKUP', 'FINANCE', ['markAwaitingPayment', 'markPaid', 'generateInvoice']],
    ['PRICED', 'PICKUP', 'SCHEDULER', []],
    ['PAID', 'PICKUP', 'SCHEDULER', ['startProcessing']],
    ['PAID', 'PICKUP', 'FINANCE', ['generateInvoice', 'refund']],
    ['READY', 'PICKUP', 'OPS_MANAGER', ['markAwaitingPickup', 'markLost', 'markDamaged', 'refund']],
    ['READY', 'DELIVERY', 'OPS_MANAGER', ['markAwaitingDelivery', 'markLost', 'markDamaged', 'refund']],
    ['AWAITING_PICKUP', 'PICKUP', 'CUSTOMER_SUPPORT', ['complete']],
    ['COMPLETED', 'DELIVERY', 'TENANT_OWNER', ['generateInvoice', 'refund']],
  ] as const)('%s + %s + %s → %j', (status, fulfillment, role, expected) => {
    expect(laundryOrderActions(status, fulfillment, role)).toEqual(expected);
  });

  it('gives ANALYST and SUPER_ADMIN no verbs on any status', () => {
    for (const status of LAUNDRY_ORDER_STATUSES) {
      for (const fulfillment of ['DELIVERY', 'PICKUP'] as const) {
        expect(laundryOrderActions(status, fulfillment, 'ANALYST')).toEqual([]);
        expect(laundryOrderActions(status, fulfillment, 'SUPER_ADMIN')).toEqual([]);
      }
    }
  });

  it('gives nobody a verb on CANCELLED, REJECTED or REFUNDED, and nothing while the role is loading', () => {
    for (const role of [...ADMIN_ROLES, undefined]) {
      for (const status of ['CANCELLED', 'REJECTED', 'REFUNDED'] as const) {
        expect(laundryOrderActions(status, 'PICKUP', role)).toEqual([]);
      }
    }
    expect(laundryOrderActions('PAID', 'PICKUP', undefined)).toEqual([]);
  });

  it('never shows SCHEDULER cancel, refund or paid; CUSTOMER_SUPPORT weigh or price; FINANCE receive', () => {
    for (const status of LAUNDRY_ORDER_STATUSES) {
      const scheduler = laundryOrderActions(status, 'PICKUP', 'SCHEDULER');
      expect(scheduler).not.toContain('cancel');
      expect(scheduler).not.toContain('refund');
      expect(scheduler).not.toContain('markPaid');
      const support = laundryOrderActions(status, 'PICKUP', 'CUSTOMER_SUPPORT');
      expect(support).not.toContain('weigh');
      expect(support).not.toContain('price');
    }
    expect(canReceiveLaundryOrder('FINANCE')).toBe(false);
    expect(canReceiveLaundryOrder('ANALYST')).toBe(false);
    expect(canReceiveLaundryOrder('CUSTOMER_SUPPORT')).toBe(true);
    expect(canReceiveLaundryOrder(undefined)).toBe(false);
  });

  it('never offers both pickup and delivery', () => {
    for (const status of LAUNDRY_ORDER_STATUSES) {
      for (const fulfillment of ['DELIVERY', 'PICKUP'] as const) {
        const verbs = laundryOrderActions(status, fulfillment, 'TENANT_OWNER');
        expect(verbs.includes('markAwaitingPickup') && verbs.includes('markAwaitingDelivery')).toBe(false);
      }
    }
  });
});

describe('laundry verb copy', () => {
  const { laundry } = getDefaultMessages();

  it('has a label, success and failure string for every verb', () => {
    for (const verb of LAUNDRY_ORDER_VERBS) {
      expect(laundry.actions[verb]).toEqual(expect.any(String));
      expect(laundry.success[verb]).toEqual(expect.any(String));
      expect(laundry.failure[verb]).toEqual(expect.any(String));
    }
  });

  it('has confirmation copy for exactly the destructive verbs', () => {
    expect(Object.keys(laundry.confirm).sort()).toEqual([...LAUNDRY_DESTRUCTIVE_VERBS].sort());
  });
});
```

Run: `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-order-actions.test.ts`
Expected: FAIL. `Cannot find module './laundry-order-actions'`.

- [ ] **Step 2: Implement**

```ts
import type { AdminRole } from '../roles/admin-roles';
import type { LaundryFulfillmentType, LaundryOrderStatus } from './laundry-order-status';

// Every order-scoped laundry verb a screen can offer. `receive` is not
// order-scoped; see `canReceiveLaundryOrder`.
export type LaundryOrderVerb =
  | 'cancel'
  | 'complete'
  | 'generateInvoice'
  | 'markAwaitingDelivery'
  | 'markAwaitingPayment'
  | 'markAwaitingPickup'
  | 'markDamaged'
  | 'markLost'
  | 'markPaid'
  | 'markReady'
  | 'price'
  | 'refund'
  | 'reject'
  | 'startProcessing'
  | 'weigh';

// Presentation order: forward lifecycle first, destructive last.
export const LAUNDRY_ORDER_VERBS: readonly LaundryOrderVerb[] = [
  'weigh',
  'price',
  'markAwaitingPayment',
  'markPaid',
  'startProcessing',
  'markReady',
  'markAwaitingPickup',
  'markAwaitingDelivery',
  'complete',
  'generateInvoice',
  'cancel',
  'reject',
  'markLost',
  'markDamaged',
  'refund',
];

// Verbs whose confirmation copy lives under `laundry.confirm`.
export const LAUNDRY_DESTRUCTIVE_VERBS: ReadonlySet<LaundryOrderVerb> = new Set<LaundryOrderVerb>([
  'cancel',
  'markDamaged',
  'markLost',
  'refund',
  'reject',
]);

// Client mirror of `LaundryOrderStatusTransitionPolicy` (lifecycle spec
// §4.3), plus the state-preserving re-weigh of a `WEIGHED` order (§4.4).
// Presentation only: the server re-checks every verb.
const LEGAL_VERBS: Readonly<Record<LaundryOrderStatus, readonly LaundryOrderVerb[]>> = {
  AWAITING_DELIVERY: ['complete', 'markLost', 'markDamaged', 'refund'],
  AWAITING_PAYMENT: ['markPaid', 'cancel'],
  AWAITING_PICKUP: ['complete', 'markLost', 'markDamaged', 'refund'],
  CANCELLED: [],
  COMPLETED: ['refund'],
  DAMAGED: ['refund'],
  LOST: ['refund'],
  PAID: ['startProcessing', 'refund'],
  PRICED: ['markAwaitingPayment', 'markPaid', 'cancel'],
  PROCESSING: ['markReady', 'markLost', 'markDamaged', 'refund'],
  READY: ['markAwaitingPickup', 'markAwaitingDelivery', 'markLost', 'markDamaged', 'refund'],
  RECEIVED: ['weigh', 'reject', 'cancel'],
  REFUNDED: [],
  REJECTED: [],
  WEIGHED: ['weigh', 'price', 'reject', 'cancel'],
};

// Invoice eligibility (laundry invoices spec §4.3): PRICED through
// COMPLETED, excluding the exceptional exits. Whether an invoice already
// exists is the screen's check; this helper only sees the order.
const INVOICEABLE: ReadonlySet<LaundryOrderStatus> = new Set<LaundryOrderStatus>([
  'AWAITING_DELIVERY',
  'AWAITING_PAYMENT',
  'AWAITING_PICKUP',
  'COMPLETED',
  'PAID',
  'PRICED',
  'PROCESSING',
  'READY',
]);

// Role sets exactly as `laundry-order.resolver.ts` and
// `invoice.resolver.ts` implement them. Do not widen.
const OPERATIONAL: readonly AdminRole[] = ['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER'];
const INTAKE: readonly AdminRole[] = [...OPERATIONAL, 'CUSTOMER_SUPPORT'];
const PAYMENT: readonly AdminRole[] = ['TENANT_OWNER', 'OPS_MANAGER', 'FINANCE', 'CUSTOMER_SUPPORT'];
const CANCEL: readonly AdminRole[] = ['TENANT_OWNER', 'OPS_MANAGER', 'CUSTOMER_SUPPORT'];
const EXCEPTION: readonly AdminRole[] = ['TENANT_OWNER', 'OPS_MANAGER'];
const REFUND: readonly AdminRole[] = ['TENANT_OWNER', 'OPS_MANAGER', 'FINANCE'];
const INVOICE: readonly AdminRole[] = ['FINANCE', 'TENANT_OWNER'];

const VERB_ROLES: Readonly<Record<LaundryOrderVerb, readonly AdminRole[]>> = {
  cancel: CANCEL,
  complete: INTAKE,
  generateInvoice: INVOICE,
  markAwaitingDelivery: OPERATIONAL,
  markAwaitingPayment: PAYMENT,
  markAwaitingPickup: OPERATIONAL,
  markDamaged: EXCEPTION,
  markLost: EXCEPTION,
  markPaid: PAYMENT,
  markReady: OPERATIONAL,
  price: OPERATIONAL,
  refund: REFUND,
  reject: EXCEPTION,
  startProcessing: OPERATIONAL,
  weigh: OPERATIONAL,
};

// Intake is not order-scoped, so it is not a `laundryOrderActions` verb.
export function canReceiveLaundryOrder(role: AdminRole | undefined): boolean {
  return role !== undefined && INTAKE.includes(role);
}

// The verbs a screen may show: matrix-legal ∩ fulfillment branch ∩ the
// actor's role (lifecycle spec §4.9, Amendment #164 §8.4.4), in
// `LAUNDRY_ORDER_VERBS` order. A missing role (still loading) sees nothing.
export function laundryOrderActions(
  status: LaundryOrderStatus,
  fulfillmentType: LaundryFulfillmentType,
  role: AdminRole | undefined,
): LaundryOrderVerb[] {
  if (role === undefined) return [];
  return LAUNDRY_ORDER_VERBS.filter((verb) => {
    const legal = verb === 'generateInvoice' ? INVOICEABLE.has(status) : LEGAL_VERBS[status].includes(verb);
    if (!legal || !VERB_ROLES[verb].includes(role)) return false;
    if (verb === 'markAwaitingPickup') return fulfillmentType === 'PICKUP';
    if (verb === 'markAwaitingDelivery') return fulfillmentType === 'DELIVERY';
    return true;
  });
}
```

Append to `packages/web/src/index.ts`:

```ts
export {
  LAUNDRY_DESTRUCTIVE_VERBS,
  LAUNDRY_ORDER_VERBS,
  canReceiveLaundryOrder,
  laundryOrderActions,
} from './laundry/laundry-order-actions';
export type { LaundryOrderVerb } from './laundry/laundry-order-actions';
```

- [ ] **Step 3: Run**

Run: `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-order-actions.test.ts`
Expected: 228 passed.

- [ ] **Step 3: Reconcile the oracle with the API source (required before commit)**

Save this script outside the repository, as `"$TMPDIR/check-laundry-oracle.mjs"`, so the scope check doesn't flag it. Then run it from the repository root. It parses the API files and the oracle, and exits 1 on any difference.

```js
// One-off reconciliation (#157 Task 4): compares the oracle in
// packages/web/src/laundry/laundry-order-actions.test.ts with the API
// sources it transcribes. Run from the repository root. Exit 1 on any
// difference. Not committed.
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const api = 'apps/api/src/modules';
const resolver = read(`${api}/laundry/presentation/graphql/laundry-order.resolver.ts`);
const invoiceResolver = read(`${api}/billing/presentation/graphql/invoice.resolver.ts`);
const policy = read(`${api}/laundry/domain/laundry-order-status-transition-policy.ts`);
const orders = read(`${api}/laundry/application/services/laundry-orders.service.ts`);
const invoices = read(`${api}/billing/application/services/invoices.service.ts`);
const oracle = read('packages/web/src/laundry/laundry-order-actions.test.ts');

const failures = [];
const same = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) console.log(`ok   ${label}`);
  else { failures.push(label); console.log(`FAIL ${label}\n     api:    ${a}\n     oracle: ${e}`); }
};
const words = (text) => [...text.matchAll(/'?(?:Role\.|S\.|LaundryOrderStatus\.)?\b([A-Z][A-Z_]+)\b'?/g)].map((m) => m[1]);
const block = (text, re) => {
  const m = text.match(re);
  if (!m) throw new Error(`pattern not found: ${re}`);
  return m[1];
};

// 1. Transition matrix.
const rows = (body, keyRe) =>
  Object.fromEntries([...body.matchAll(keyRe)].map((m) => [m[1], words(m[2]).sort()]).sort(([a], [b]) => a.localeCompare(b)));
same(
  'policy MATRIX',
  rows(block(policy, /> = \{([\s\S]*?)\n\};/), /\[S\.(\w+)\]:\s*\[([\s\S]*?)\]/g),
  rows(block(oracle, /const SERVER_MATRIX[^=]*= \{([\s\S]*?)\n\};/), /(\w+): \[([\s\S]*?)\]/g),
);

// 2. Role constants (expanding `...OPERATIONAL`).
const constants = (text, prefix) => {
  const out = {};
  for (const [, name, body] of text.matchAll(new RegExp(`${prefix}(OPERATIONAL|INTAKE|PAYMENT|CANCEL|EXCEPTION|REFUND)(?::[^=]*)? = \\[([\\s\\S]*?)\\];`, 'g'))) {
    out[name] = [...(body.includes('...OPERATIONAL') ? out.OPERATIONAL : []), ...words(body.replace('...OPERATIONAL', ''))].sort();
  }
  return out;
};
same('role constants', constants(resolver, 'const '), constants(oracle, 'const '));

// 3. Mutation -> role constant.
const apiMutations = Object.fromEntries(
  [...resolver.matchAll(/@Roles\(\.\.\.(\w+)\)\s*\n\s*(?:async\s+)?(\w+)\(/g)]
    .filter(([, c]) => c !== 'VIEW_ROLES')
    .map(([, c, m]) => [m, c])
    .filter(([m]) => m !== 'receiveLaundryOrder')
    .sort(([a], [b]) => a.localeCompare(b)),
);
const oracleMutations = Object.fromEntries(
  [...oracle.matchAll(/^  (\w+): \{ legal: [^}]*?roles: (\w+), verb/gm)].map(([, m, c]) => [m, c]).sort(([a], [b]) => a.localeCompare(b)),
);
same('mutation -> @Roles constant', apiMutations, oracleMutations);
same('receiveLaundryOrder roles', block(resolver, /@Roles\(\.\.\.(\w+)\)\s*\n\s*async receiveLaundryOrder/), 'INTAKE');

// 4. Invoice generation roles and eligibility.
same(
  'generateInvoiceFromOrder roles',
  words(block(invoiceResolver, /@Roles\(([^)]*)\)\s*\n\s*(?:async\s+)?generateInvoiceFromOrder/)).sort(),
  words(block(oracle, /generateInvoiceFromOrder: \{[\s\S]*?roles: \[([^\]]*)\]/)).sort(),
);
same(
  'invoice EXCLUDED_STATUSES',
  words(block(invoices, /EXCLUDED_STATUSES[^=]*= new Set\(\[([\s\S]*?)\]\)/)).sort(),
  words(block(oracle, /const INVOICE_EXCLUDED[^=]*= \[([^\]]*)\]/)).sort(),
);
same('invoice requires priced (totalMinorUnits !== null)', /order\.totalMinorUnits === null\)\s*\{\s*throw/.test(invoices), true);

// 5. Weigh / price preconditions.
same('price only from WEIGHED', /order\.status !== S\.WEIGHED\)\s*\{\s*throw new BadRequestException\(\s*`Cannot price/.test(orders), true);
same(
  'weigh from RECEIVED or WEIGHED, else throw',
  /order\.status === S\.RECEIVED\)[\s\S]*?else if \(order\.status === S\.WEIGHED\)[\s\S]*?else \{\s*throw new BadRequestException\(\s*`Cannot weigh/.test(orders),
  true,
);

// 6. No SUPER_ADMIN bypass in the role check.
const guard = read('apps/api/src/platform/auth/guards/auth.guard.ts');
same('AuthGuard: listed roles only, no SUPER_ADMIN bypass', /!requiredRoles\.includes\(principal\.role\)/.test(guard) && !guard.includes('SUPER_ADMIN'), true);

console.log(failures.length === 0 ? 'ORACLE: matches API source' : `ORACLE: ${failures.length} difference(s)`);
process.exit(failures.length === 0 ? 0 : 1);
```

Run: `node "$TMPDIR/check-laundry-oracle.mjs"`
Expected: 10 lines starting `ok`, then `ORACLE: matches API source`, exit 0. On any `FAIL`, fix whichever side disagrees with the API, the oracle or the helper, and don't commit until it passes.

- [ ] **Step 3a: Negative checks (do not commit)**

1. In the test's `SERVER_MATRIX`, change `PAID: ['PROCESSING', 'REFUNDED']` to `PAID: ['PROCESSING', 'REFUNDED', 'CANCELLED']`, then run the script. Expected: `ORACLE: 1 difference(s)`, exit 1. Restore it.
2. In the helper, add `'SCHEDULER'` to `REFUND`, then run the Step 2 test command. Expected: 18 failed / 210 passed. Restore it.
3. In the helper's `LEGAL_VERBS`, change `PAID: ['startProcessing', 'refund']` to `PAID: ['startProcessing', 'refund', 'cancel']`, then run the test. Expected: 6 failed / 222 passed. Restore it. 228 pass again.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/laundry/laundry-order-actions.ts packages/web/src/laundry/laundry-order-actions.test.ts packages/web/src/index.ts
git commit -m "feat(web): add the role- and transition-aware laundry action helper (#157)"
```

### Task 5: Progress presentation (issue deliverable 5; spec §4.3, §8.4.4)

**Files:** Create `packages/web/src/laundry/laundry-order-progress.tsx` and `laundry-order-progress.test.tsx`. Modify `packages/web/src/index.ts`.

- [ ] **Step 1: Write the failing test**

It is table-driven over every status × both fulfillment types. Every consistent pair asserts the **full ordered sequence** against the written-out `PATH` / `AWAITING_PAYMENT_PATH` and the state of every step. `AWAITING_PAYMENT`, `PAID`, both return branches and `COMPLETED` assert their full step lists literally. The markup tests check the ordered list, the label sequence, the screen-reader state of every step, `aria-current` only on the current step (none for `COMPLETED`), and no buttons or links. The two mismatched pairs (`AWAITING_DELIVERY` with `PICKUP`, `AWAITING_PICKUP` with `DELIVERY`) are separate assertions. Terminal statuses render a badge and a sentence, with no `aria-current`.

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClensyI18nProvider } from '../i18n/i18n-context';
import { getDefaultMessages } from '../i18n/messages';
import { LaundryOrderProgress, laundryProgressSteps } from './laundry-order-progress';
import { LAUNDRY_ORDER_STATUSES, type LaundryFulfillmentType, type LaundryOrderStatus } from './laundry-order-status';

const FULFILLMENTS: readonly LaundryFulfillmentType[] = ['DELIVERY', 'PICKUP'];
const TERMINAL: readonly LaundryOrderStatus[] = ['CANCELLED', 'DAMAGED', 'LOST', 'REFUNDED', 'REJECTED'];
const NON_TERMINAL = LAUNDRY_ORDER_STATUSES.filter((s) => !TERMINAL.includes(s));
const { laundry } = getDefaultMessages();

// The §4.3 happy path, spelled out per fulfillment type: the displayed
// sequence every non-terminal status must render (Paid slot reads
// "Awaiting payment" only while that is the status).
const PATH: Record<LaundryFulfillmentType, LaundryOrderStatus[]> = {
  DELIVERY: ['RECEIVED', 'WEIGHED', 'PRICED', 'PAID', 'PROCESSING', 'READY', 'AWAITING_DELIVERY', 'COMPLETED'],
  PICKUP: ['RECEIVED', 'WEIGHED', 'PRICED', 'PAID', 'PROCESSING', 'READY', 'AWAITING_PICKUP', 'COMPLETED'],
};
const AWAITING_PAYMENT_PATH: Record<LaundryFulfillmentType, LaundryOrderStatus[]> = {
  DELIVERY: ['RECEIVED', 'WEIGHED', 'PRICED', 'AWAITING_PAYMENT', 'PROCESSING', 'READY', 'AWAITING_DELIVERY', 'COMPLETED'],
  PICKUP: ['RECEIVED', 'WEIGHED', 'PRICED', 'AWAITING_PAYMENT', 'PROCESSING', 'READY', 'AWAITING_PICKUP', 'COMPLETED'],
};
// Non-terminal statuses the server can write for this fulfillment type.
// The mismatched return statuses are asserted separately below.
const consistent = (fulfillment: LaundryFulfillmentType) =>
  NON_TERMINAL.filter((s) => s !== (fulfillment === 'PICKUP' ? 'AWAITING_DELIVERY' : 'AWAITING_PICKUP'));
const expectedPath = (status: LaundryOrderStatus, fulfillment: LaundryFulfillmentType) =>
  status === 'AWAITING_PAYMENT' ? AWAITING_PAYMENT_PATH[fulfillment] : PATH[fulfillment];

// renderToStaticMarkup escapes text (an apostrophe becomes &#x27;).
function escaped(text: string): string {
  return text.replaceAll("'", '&#x27;');
}

function render(status: LaundryOrderStatus, fulfillmentType: LaundryFulfillmentType) {
  return renderToStaticMarkup(
    <ClensyI18nProvider>
      <LaundryOrderProgress fulfillmentType={fulfillmentType} status={status} />
    </ClensyI18nProvider>,
  );
}

function stepItems(html: string): { current: boolean; label: string; state: string }[] {
  return [...html.matchAll(/<li( aria-current="step")?[^>]*>.*?<span[^>]*>([^<]*)<\/span><span class="sr-only">([^<]*)<\/span><\/li>/g)].map(
    (m) => ({ current: m[1] !== undefined, label: m[2], state: m[3] }),
  );
}

describe('laundryProgressSteps', () => {
  it('walks the pickup happy path with the current step marked', () => {
    expect(laundryProgressSteps('PRICED', 'PICKUP')).toEqual([
      { state: 'complete', status: 'RECEIVED' },
      { state: 'complete', status: 'WEIGHED' },
      { state: 'current', status: 'PRICED' },
      { state: 'upcoming', status: 'PAID' },
      { state: 'upcoming', status: 'PROCESSING' },
      { state: 'upcoming', status: 'READY' },
      { state: 'upcoming', status: 'AWAITING_PICKUP' },
      { state: 'upcoming', status: 'COMPLETED' },
    ]);
  });

  describe.each(FULFILLMENTS)('every status with %s', (fulfillment) => {
    it.each(consistent(fulfillment))('%s renders the full happy-path sequence with the right state on every step', (status) => {
      const steps = laundryProgressSteps(status, fulfillment) ?? [];
      const path = expectedPath(status, fulfillment);
      expect(steps.map((s) => s.status)).toEqual(path);
      const at = path.indexOf(status);
      expect(steps.map((s) => s.state)).toEqual(
        path.map((_, index) =>
          status === 'COMPLETED' || index < at ? 'complete' : index === at ? 'current' : 'upcoming',
        ),
      );
      expect(steps.filter((s) => s.state === 'current')).toHaveLength(status === 'COMPLETED' ? 0 : 1);
    });

    it.each(TERMINAL)('%s replaces the steps', (status) => {
      expect(laundryProgressSteps(status, fulfillment)).toBeNull();
    });
  });

  it('AWAITING_PAYMENT takes the Paid slot as current, never as a done Paid step', () => {
    expect(laundryProgressSteps('AWAITING_PAYMENT', 'DELIVERY')).toEqual([
      { state: 'complete', status: 'RECEIVED' },
      { state: 'complete', status: 'WEIGHED' },
      { state: 'complete', status: 'PRICED' },
      { state: 'current', status: 'AWAITING_PAYMENT' },
      { state: 'upcoming', status: 'PROCESSING' },
      { state: 'upcoming', status: 'READY' },
      { state: 'upcoming', status: 'AWAITING_DELIVERY' },
      { state: 'upcoming', status: 'COMPLETED' },
    ]);
    expect(laundryProgressSteps('AWAITING_PAYMENT', 'PICKUP')?.map((s) => s.status)).toEqual(AWAITING_PAYMENT_PATH.PICKUP);
  });

  it('PAID is the current Paid step', () => {
    expect(laundryProgressSteps('PAID', 'PICKUP')).toEqual([
      { state: 'complete', status: 'RECEIVED' },
      { state: 'complete', status: 'WEIGHED' },
      { state: 'complete', status: 'PRICED' },
      { state: 'current', status: 'PAID' },
      { state: 'upcoming', status: 'PROCESSING' },
      { state: 'upcoming', status: 'READY' },
      { state: 'upcoming', status: 'AWAITING_PICKUP' },
      { state: 'upcoming', status: 'COMPLETED' },
    ]);
  });

  it.each([
    ['AWAITING_PICKUP', 'PICKUP'],
    ['AWAITING_DELIVERY', 'DELIVERY'],
  ] as const)('%s is the current return step on its own branch', (status, fulfillment) => {
    expect(laundryProgressSteps(status, fulfillment)).toEqual([
      { state: 'complete', status: 'RECEIVED' },
      { state: 'complete', status: 'WEIGHED' },
      { state: 'complete', status: 'PRICED' },
      { state: 'complete', status: 'PAID' },
      { state: 'complete', status: 'PROCESSING' },
      { state: 'complete', status: 'READY' },
      { state: 'current', status },
      { state: 'upcoming', status: 'COMPLETED' },
    ]);
  });

  it('COMPLETED marks every step done and none current', () => {
    expect(laundryProgressSteps('COMPLETED', 'DELIVERY')).toEqual(
      PATH.DELIVERY.map((status) => ({ state: 'complete', status })),
    );
  });

  it.each(FULFILLMENTS)('after payment (%s) the Paid slot reads Paid: current at PAID, done from PROCESSING', (fulfillment) => {
    expect((laundryProgressSteps('PRICED', fulfillment) ?? [])[3]).toEqual({ state: 'upcoming', status: 'PAID' });
    expect((laundryProgressSteps('PAID', fulfillment) ?? [])[3]).toEqual({ state: 'current', status: 'PAID' });
    expect((laundryProgressSteps('PROCESSING', fulfillment) ?? [])[3]).toEqual({ state: 'complete', status: 'PAID' });
  });

  it('shows only the order\'s own return step', () => {
    expect((laundryProgressSteps('READY', 'PICKUP') ?? [])[6].status).toBe('AWAITING_PICKUP');
    expect((laundryProgressSteps('READY', 'DELIVERY') ?? [])[6].status).toBe('AWAITING_DELIVERY');
  });

  it.each([
    ['AWAITING_DELIVERY', 'PICKUP'],
    ['AWAITING_PICKUP', 'DELIVERY'],
  ] as const)('a mismatched %s + %s still shows the recorded status as the current step', (status, fulfillment) => {
    const steps = laundryProgressSteps(status, fulfillment) ?? [];
    expect(steps.map((s) => s.status)).toEqual(['RECEIVED', 'WEIGHED', 'PRICED', 'PAID', 'PROCESSING', 'READY', status, 'COMPLETED']);
    expect(steps[6]).toEqual({ state: 'current', status });
    expect(steps.filter((s) => s.state === 'current')).toHaveLength(1);
    const current = stepItems(render(status, fulfillment)).filter((i) => i.current);
    expect(current).toEqual([{ current: true, label: laundry.status[status], state: laundry.progress.state.current }]);
  });
});

describe('LaundryOrderProgress', () => {
  describe.each(FULFILLMENTS)('with %s', (fulfillment) => {
    it.each(consistent(fulfillment))('%s: the labeled sequence in an ordered list, accessible states, no controls', (status) => {
      const html = render(status, fulfillment);
      expect(html).toContain('<ol aria-label="Order progress"');
      expect(html).not.toContain('<button');
      expect(html).not.toContain('<a ');
      const items = stepItems(html);
      expect(items.map((i) => i.label)).toEqual(expectedPath(status, fulfillment).map((s) => laundry.status[s]));
      const steps = laundryProgressSteps(status, fulfillment) ?? [];
      expect(items.map((i) => i.state)).toEqual(steps.map((s) => laundry.progress.state[s.state]));
      expect(items.map((i) => i.current)).toEqual(steps.map((s) => s.state === 'current'));
      if (status === 'COMPLETED') {
        expect(html).not.toContain('aria-current');
        expect(items.every((i) => i.state === laundry.progress.state.complete)).toBe(true);
      } else {
        const current = items.filter((i) => i.current);
        expect(current).toHaveLength(1);
        expect(current[0]).toEqual({ current: true, label: laundry.status[status], state: laundry.progress.state.current });
      }
    });

    it.each(TERMINAL)('%s: a badge and its sentence, no steps', (status) => {
      const html = render(status, fulfillment);
      expect(html).not.toContain('<ol');
      expect(html).not.toContain('aria-current');
      expect(html).toContain(laundry.status[status]);
      expect(html).toContain(escaped(laundry.progress.terminal[status as keyof typeof laundry.progress.terminal]));
    });
  });

  it('labels AWAITING_PAYMENT as awaiting payment, not paid', () => {
    const items = stepItems(render('AWAITING_PAYMENT', 'PICKUP'));
    expect(items[3]).toEqual({ current: true, label: 'Awaiting payment', state: 'Current step' });
    expect(items.map((i) => i.label)).not.toContain('Paid');
  });
});
```

Run: `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-order-progress.test.tsx`
Expected: FAIL. `Cannot find module './laundry-order-progress'`.

- [ ] **Step 2: Implement**

`contextforge/function-order` puts the exported component before `laundryProgressSteps`.

```tsx
'use client';

import { StatusBadge } from '@clensy/ui';
import { useClensyTranslations } from '../i18n/use-clensy-translations';
import { LAUNDRY_STATUS_TONE, type LaundryFulfillmentType, type LaundryOrderStatus } from './laundry-order-status';

export type LaundryProgressState = 'complete' | 'current' | 'upcoming';

export interface LaundryProgressStep {
  state: LaundryProgressState;
  status: LaundryOrderStatus;
}

export interface LaundryOrderProgressProps {
  fulfillmentType: LaundryFulfillmentType;
  status: LaundryOrderStatus;
}

type TerminalStatus = 'CANCELLED' | 'DAMAGED' | 'LOST' | 'REFUNDED' | 'REJECTED';

// Every status, mapped once (exhaustive, so a new status fails to compile).
// A terminal exception replaces the steps. `COMPLETED` marks every step done
// and none current (no `aria-current`). Any other status is the single
// current step at that slot of the §4.3 happy path: `AWAITING_PAYMENT`
// shares the Paid slot with `PAID`, and `AWAITING_PICKUP` /
// `AWAITING_DELIVERY` share the return slot.
const PROGRESS_SLOT: Readonly<Record<LaundryOrderStatus, number | 'terminal'>> = {
  AWAITING_DELIVERY: 6,
  AWAITING_PAYMENT: 3,
  AWAITING_PICKUP: 6,
  CANCELLED: 'terminal',
  COMPLETED: 7,
  DAMAGED: 'terminal',
  LOST: 'terminal',
  PAID: 3,
  PRICED: 2,
  PROCESSING: 4,
  READY: 5,
  RECEIVED: 0,
  REFUNDED: 'terminal',
  REJECTED: 'terminal',
  WEIGHED: 1,
};

const MARKER_CLASSES: Record<LaundryProgressState, string> = {
  complete: 'bg-slate-900',
  current: 'bg-white ring-2 ring-slate-900',
  upcoming: 'bg-slate-200',
};

export function LaundryOrderProgress({ fulfillmentType, status }: LaundryOrderProgressProps) {
  const t = useClensyTranslations('laundry');
  const steps = laundryProgressSteps(status, fulfillmentType);

  if (steps === null) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <StatusBadge label={t(`status.${status}`)} tone={LAUNDRY_STATUS_TONE[status]} />
        <p className="text-slate-700">{t(`progress.terminal.${status as TerminalStatus}`)}</p>
      </div>
    );
  }

  return (
    <ol aria-label={t('progress.label')} className="flex flex-col gap-2 text-sm">
      {steps.map((step) => (
        <li
          key={step.status}
          aria-current={step.state === 'current' ? 'step' : undefined}
          className="flex items-center gap-2"
        >
          <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${MARKER_CLASSES[step.state]}`} />
          <span className={step.state === 'upcoming' ? 'text-slate-500' : 'font-medium text-slate-900'}>
            {t(`status.${step.status}`)}
          </span>
          <span className="sr-only">{t(`progress.state.${step.state}`)}</span>
        </li>
      ))}
    </ol>
  );
}

// The §4.3 happy path for this order, or `null` for a terminal exception.
// The Paid slot reads "Awaiting payment" only while that is the status: it
// is a branch, never shown as a completed step. The return slot follows the
// status when the status is one of its two values, so a status and a
// `fulfillmentType` that disagree (the server never writes that) still
// render the recorded status as current; otherwise it follows
// `fulfillmentType`.
export function laundryProgressSteps(
  status: LaundryOrderStatus,
  fulfillmentType: LaundryFulfillmentType,
): LaundryProgressStep[] | null {
  const slot = PROGRESS_SLOT[status];
  if (slot === 'terminal') return null;
  const returnStep: LaundryOrderStatus =
    status === 'AWAITING_DELIVERY' || status === 'AWAITING_PICKUP'
      ? status
      : fulfillmentType === 'PICKUP'
        ? 'AWAITING_PICKUP'
        : 'AWAITING_DELIVERY';
  const path: LaundryOrderStatus[] = [
    'RECEIVED',
    'WEIGHED',
    'PRICED',
    status === 'AWAITING_PAYMENT' ? 'AWAITING_PAYMENT' : 'PAID',
    'PROCESSING',
    'READY',
    returnStep,
    'COMPLETED',
  ];
  return path.map((step, index) => ({
    state: index < slot || status === 'COMPLETED' ? 'complete' : index === slot ? 'current' : 'upcoming',
    status: step,
  }));
}
```

Append to `packages/web/src/index.ts`:

```ts
export { LaundryOrderProgress, laundryProgressSteps } from './laundry/laundry-order-progress';
export type { LaundryOrderProgressProps, LaundryProgressState, LaundryProgressStep } from './laundry/laundry-order-progress';
```

- [ ] **Step 3: Run**

Run: `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-order-progress.test.tsx`
Expected: 68 passed.

- [ ] **Step 3a: Mutation checks (do not commit; restore after each)**

1. In `laundryProgressSteps`, replace the `returnStep` expression with `fulfillmentType === 'PICKUP' ? 'AWAITING_PICKUP' : 'AWAITING_DELIVERY'`, which drops the status-follows rule. Expected: 2 failed / 66 passed (the mismatched pairs).
2. Swap `'PROCESSING'` and `'READY'` in `path`. Expected: 44 failed / 24 passed.
3. In the component, set `aria-current={step.status === status ? 'step' : undefined}`. Expected: 2 failed / 66 passed (`COMPLETED`, both fulfillment types).

After restoring, 68 pass.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/laundry/laundry-order-progress.tsx packages/web/src/laundry/laundry-order-progress.test.tsx packages/web/src/index.ts
git commit -m "feat(web): add the laundry order progress component (#157)"
```

### Task 6: Pin the local identifiers to the generated client (Global Constraints: no `@clensy/client` import in `@clensy/web`)

**Files:** Create `apps/web/lib/laundry-presentation-contract.test.ts`

This is a contract test. It is green as soon as Tasks 2–5 are in, and the mutation check below proves it bites. The `expectTypeOf` assertions are enforced by `tsc --noEmit`, because apps/web's `tsconfig` includes `**/*.ts`.

- [ ] **Step 1: Write the test**

```ts
import type {
  InvoicePaymentStatus,
  InvoicePaymentTerms,
  LaundryFulfillmentType as ClientFulfillmentType,
  LaundryOrderStatus as ClientStatus,
  Role,
} from '@clensy/client';
import {
  LAUNDRY_ORDER_STATUSES,
  type AdminRole,
  type ClensyMessages,
  type LaundryFulfillmentType,
  type LaundryOrderStatus,
} from '@clensy/web';
import { describe, expect, expectTypeOf, it } from 'vitest';

type LaundryMessages = ClensyMessages['laundry'];

describe('laundry presentation contract with the generated client', () => {
  it('uses exactly the generated status, fulfillment and role unions', () => {
    expectTypeOf<LaundryOrderStatus>().toEqualTypeOf<ClientStatus>();
    expectTypeOf<LaundryFulfillmentType>().toEqualTypeOf<ClientFulfillmentType>();
    expectTypeOf<AdminRole>().toEqualTypeOf<Role>();
  });

  it('lists every generated status once and labels every status, fulfillment and invoice enum value', () => {
    const everyStatus: Record<ClientStatus, true> = {
      AWAITING_DELIVERY: true,
      AWAITING_PAYMENT: true,
      AWAITING_PICKUP: true,
      CANCELLED: true,
      COMPLETED: true,
      DAMAGED: true,
      LOST: true,
      PAID: true,
      PRICED: true,
      PROCESSING: true,
      READY: true,
      RECEIVED: true,
      REFUNDED: true,
      REJECTED: true,
      WEIGHED: true,
    };
    expect([...LAUNDRY_ORDER_STATUSES].sort()).toEqual(Object.keys(everyStatus).sort());
    expectTypeOf<keyof LaundryMessages['invoicePaymentStatus']>().toEqualTypeOf<InvoicePaymentStatus>();
    expectTypeOf<keyof LaundryMessages['paymentTerms']>().toEqualTypeOf<InvoicePaymentTerms>();
    expectTypeOf<keyof LaundryMessages['status']>().toEqualTypeOf<ClientStatus>();
    expectTypeOf<keyof LaundryMessages['fulfillment']>().toEqualTypeOf<ClientFulfillmentType>();
  });
});
```

- [ ] **Step 2: Run it and type-check**

Run: `pnpm --filter web exec vitest run lib/laundry-presentation-contract.test.ts && pnpm --filter web exec tsc --noEmit`
Expected: 2 passed. tsc exit 0.

- [ ] **Step 3: Mutation check (do not commit)**

Delete the line `    VOID: 'Void',` from `packages/web/src/i18n/messages/en/laundry.ts`, then run `pnpm --filter web exec tsc --noEmit`.
Expected: 1 type error, in `laundry-presentation-contract.test.ts`. Restore the line with `git checkout -- packages/web/src/i18n/messages/en/laundry.ts`. tsc exit 0 again.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/laundry-presentation-contract.test.ts
git commit -m "test(web): pin laundry presentation identifiers to the generated client (#157)"
```

## Final verification (before the M6 handoff report)

Run:

```bash
pnpm --filter @clensy/web test && pnpm --filter @clensy/web build && pnpm --filter @clensy/web lint
pnpm --filter web test && pnpm --filter web exec tsc --noEmit && pnpm --filter web lint && pnpm --filter web build
```

Then the scope check. It returns non-zero (via `false`, not `exit`, so an interactive shell stays open):

```bash
unexpected=$({ git diff --name-only 7c59b82; git ls-files --others --exclude-standard; } | sort -u \
  | grep -vxE 'docs/superpowers/plans/2026-10-10-laundry-ui-foundation-plan\.md|apps/web/lib/laundry-page-baseline\.test\.tsx|apps/web/lib/laundry-presentation-contract\.test\.ts|packages/web/src/i18n/messages\.ts|packages/web/src/i18n/messages/en/laundry\.ts|packages/web/src/index\.ts|packages/web/src/laundry/(format-weight-grams|laundry-order-actions|laundry-order-progress|laundry-order-status)(\.test)?\.tsx?' \
  || true)
if [ -n "$unexpected" ]; then
  printf 'SCOPE: unexpected files:\n%s\n' "$unexpected"
  false
else
  echo 'SCOPE: ok'
fi
```

Expected: `@clensy/web` 11 files / 376 tests passed, tsc and lint exit 0. `web` 24 files / 595 tests passed, tsc, lint and build exit 0. The scope check prints `SCOPE: ok` and returns 0. It covers committed, uncommitted and untracked changes against the base. Any file outside the allowlist (this plan, the two `apps/web/lib` tests, and the `packages/web/src` files in the File Map) is printed after `SCOPE: unexpected files:`, the status is 1, and `SCOPE: ok` is not printed. The M6 gate record appends to this plan, so the plan file is on the list.

Negative case (run once, then delete the file): `touch packages/ui/src/stray.ts`, then run the scope check. Expected: `SCOPE: unexpected files:` and `packages/ui/src/stray.ts`, status 1, no `SCOPE: ok`. Then `rm packages/ui/src/stray.ts`.

## Traceability

| Requirement | Source | Task |
| --- | --- | --- |
| Human-readable status and fulfillment labels | §8.4.4 | 2 |
| Status tones | §4.9 | 3 |
| Kilograms from integer grams | §8.4.4 | 3 |
| Action set = matrix ∩ fulfillment branch ∩ role, presentation only | §4.3, §4.4, §4.9, §8.4.4 | 4 |
| Re-weigh only in `RECEIVED` / `WEIGHED`; price only in `WEIGHED` | §4.4, §8.4.4 | 4 |
| Invoice generation roles and eligible range | Laundry invoices spec §4.3 | 4 |
| Explicit confirmation for cancel, reject, lost, damaged, refund | §8.4.4 | 2, 4 |
| `AWAITING_PAYMENT` shown as a branch, not a required step; pickup/delivery exclusive | §8.4.4, §4.3 | 5 |
| Shared presentation layer, baseline characterization | #157 deliverables 1–6 | 1–6 |

## Deferred (not in this plan)

- Every screen: list (#163), intake modal (#160), order page (#156), weighing (#155), services (#158), price review (#162), invoice card (#166), lifecycle buttons (#165), and the drawer removal (#161). Each consumes these helpers.
- Moving `formatMinorUnits` into `@clensy/web`. Money formatting stays where it is.
- Committing the API-source reconciliation as a test. Task 4 Step 3's script is a required, repeatable step instead. As a committed test it would break on API formatting changes, and `@clensy/web` cannot import `apps/api`. Later slices that touch laundry RBAC or the matrix re-run it.
- Positive-weight validation (§8.4.1) is #155. Price preview and line descriptions (§8.4.2, §8.4.5) are #159.

## Execution risks (operational only)

- The baseline test mocks every hook `page.tsx` imports from `@clensy/client`. If the page gains an import before this lands, the mock must list it, because Vitest throws on a missing mocked export.
- `apps/web/AGENTS.md`: `next dev` may re-add its agent block. Do not commit unrelated `AGENTS.md` changes.

## Gate outcomes

### M5 — Accepted (2026-10-10, third pass)

Accepted at `92d6fca` by the owner. The first pass returned eight findings and the second pass four. All were applied and re-pre-validated (M5 history). The owner also corrected the second-pass reasoning on the scope check: the original `&& { …; exit 1; } || echo` form did fail closed when run as a script. The interactive-terminal hazard was the separate, valid reason to adopt the `if`/`else` form. The acceptance is limited to the plan's allowlist. It does not authorize API, UI-kit, client or page changes in this slice.

### M6 — Implementation complete (2026-10-10)

Implemented on `feat/157-laundry-ui-foundation`, from the Accepted plan at `98285a2` and the Accepted lifecycle spec with Amendment #164. Tasks 1–6 were done in plan order, one commit each. Every code block was applied as written in this plan. No task was split, merged or reordered, and no semantics were added.

| Task | Commit | Evidence |
| --- | --- | --- |
| 1 Baseline (**characterization**) | `1fdfd0f` | 1 passed against the unchanged page. Failure evidence, not committed: mutating `page.tsx`'s weight to `toFixed(3)` failed it (`Expected: "2.50 kg"`). Reverted. |
| 2 Catalog | `534c3e3` | `@clensy/web` tsc exit 0. The existing 8 files / 63 tests passed. |
| 3 Status + weight | `b795c69` | RED `Cannot find module './format-weight-grams'` → GREEN 17 passed |
| 4 Actions | `5af94cd` | RED `Cannot find module './laundry-order-actions'` → GREEN 228 passed. Step 3 oracle script: 10/10 `ok`, `ORACLE: matches API source`, exit 0. Step 3a: oracle `PAID` slip gave `1 difference(s)`, exit 1. `REFUND` + `SCHEDULER` gave 18 failed / 210 passed. `PAID` + `cancel` gave 6 failed / 222 passed. All restored, 228 passed. |
| 5 Progress | `e1a68be` | RED `Cannot find module './laundry-order-progress'` → GREEN 68 passed. Step 3a: mismatch rule dropped gave 2 failed / 66 passed. `PROCESSING`/`READY` swapped gave 44 failed / 24 passed. `aria-current` from `step.status === status` gave 2 failed / 66 passed. All restored, 68 passed. |
| 6 Client contract | `84cee8d` | 2 passed, `web` tsc exit 0. Mutation: dropping `VOID` gave 1 type error. Restored, tsc exit 0. |

Final verification: `@clensy/web` 11 files / 376 tests passed, tsc and lint exit 0. `web` 24 files / 595 tests passed, tsc, lint and build exit 0. Scope check `SCOPE: ok` (status 0). Negative case: a stray `packages/ui/src/stray.ts` was listed, status 1, no `SCOPE: ok`; then removed.

Deviation: none. One process correction: the Task 1 commit was first created with a `Co-Authored-By` trailer, against the owner's global commit rule. It was amended before any push. No pushed commit carries one.

Next gate: **M7 — Code Review**. A fresh independent reviewer is required (`CLAUDE.md`: application code).
