# Reusable `DataTable` and `BookingDataTable` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three new `@clensy/ui` building blocks — a shadcn-generated `Table` primitive, a shadcn-generated `Checkbox` primitive, and a generic `Pagination` composition — and rewrite `packages/ui/src/base/data-table.tsx` to compose them instead of its own hand-rolled `<table>` markup, while adding controlled sorting, controlled row selection, and a toolbar slot as new optional props. Then introduce `BookingDataTable` in `@clensy/web` (new `packages/web/src/bookings/`), owning Bookings' seven existing columns, and thin `apps/web/app/app/bookings/page.tsx` down to compose it.

**Architecture:** `DataTable` becomes a behavior/composition layer, not a table primitive — `Table`/`Checkbox` are real shadcn primitives (`packages/ui/src/base/table.tsx`, `packages/ui/src/base/checkbox.tsx`, both zero-new-dependency since `radix-ui` and `lucide-react` are already `packages/ui` dependencies), `Pagination` is a generic composition (`packages/ui/src/base/pagination.tsx`, built from the existing `Button` primitive). `data-table.tsx`'s external prop API (`columns`, `rows`, `rowKey`, `emptyMessage`, `loading`, `error`, `onRowClick`, `pagination`) keeps its exact current shape and meaning — the nine non-Bookings consumer files (eleven `<DataTable>` call sites) need no code change. `BookingDataTable` follows the `LoginForm` precedent: plain values and host-injected callbacks in, no `@clensy/client`/`@apollo/client`/`next-intl` import.

**Tech Stack:** TypeScript (existing `packages/ui`/`packages/web` `tsconfig.json`s, unchanged), Vitest (`packages/ui` already has it; `packages/web` gains it new, mirroring the precedent set when `packages/ui` gained it), Next.js/Tailwind 4 build already scanning `packages/ui/src` (unchanged).

**Spec:** [docs/superpowers/specs/2026-09-19-reusable-data-table-design.md](../specs/2026-09-19-reusable-data-table-design.md) (Accepted, M3 2026-09-19). Where this plan and the spec disagree, the spec wins — stop and return to M2/M3 rather than resolving the conflict here.

**M4 planning decision (this plan's own, per spec §4.4):** the spec deliberately left `BookingDataTable`'s `Booking` type as either a structural GraphQL-result pass-through or an explicit `BookingDataTableItem` view model + `apps/web`-side adapter — both spec-compliant. This plan picks **structural pass-through** (spec §4.4 option 1): `apps/web` passes its query result directly, no adapter function. Rationale: the seven fields `BookingDataTable` needs are already exactly what `useBookingsQuery`'s result shape provides today (verified against the current `BookingRow` type in `apps/web/app/app/bookings/page.tsx`); an adapter would exist solely to reshape already-compatible data, which the spec's own §4.4 rationale flags as unnecessary overhead. If a future consumer's GraphQL shape diverges, that consumer can adopt option 2 without this plan needing to change.

**M5 decision:** **Accepted** — 2026-09-19. One review round required: extracting the selection-transition logic (`toggleSelectionKey`/`togglePageSelection`) as pure, directly-testable functions and fixing `togglePageSelection` to filter against `selectableKeys` rather than all current-page keys (closing a real bug where select-all could silently drop a pre-existing selection on a non-selectable row); making the `Table`/`Checkbox` "shadcn-generated" claim actually true (CLI-first, with an explicitly-labeled hand-authored fallback for a network-unavailable sandbox, via a new `packages/ui/components.json`); replacing the pagination test's order-dependent regex assertions with `aria-label`-anchored structural extraction; splitting the sort test into pure-transition and rendering-only halves; replacing the `Booking` assignability claim's reliance on an `as` cast with an actual uncast-assignment/`tsc` check at the Task 6 call site (falling back to spec §4.4's option 2 only if that check fails); instructing a verbatim copy of `formatScheduledAt` rather than a reconstruction; correcting the consumer inventory (9 non-Bookings files / 11 call sites, 10/12 total — also corrected in the now-Accepted spec, a factual fix, no normative change); and capturing a pre-existing working-tree baseline (Task 0) so Task 7's zero-diff gates are interpreted against it rather than an assumed-clean tree. All applied. No remaining executability or traceability blocker. Ready for M6 implementation.

**Also relies on (Accepted, unmodified by this plan):** [`@clensy/ui` as the Shared UI System](../specs/2026-09-16-shadcn-ui-boundary-design.md) (the existing `base/` layout and the seven already-relocated primitives — this plan adds three more the same way, touches none of the existing seven). [`@clensy/web` / `LoginForm`](../specs/2026-09-19-clensy-web-login-form-design.md) (`packages/web`'s existing boundary and package layout — this plan adds a sibling domain folder, `bookings/`, next to the existing `auth/`, and touches nothing in `auth/`).

---

## Global Constraints

- SHALL generate `Table` and `Checkbox` via the shadcn CLI, using a new `packages/ui/components.json` pointed at `packages/ui/src/base` — establishing this package's shadcn CLI workflow now, per `packages/ui/README.md`'s own deferral ("established when the next primitive is actually needed"). SHALL NOT present hand-authored source as CLI-generated; the network-unavailable fallback (Task 1/Step 1, Task 2/Step 2) must be labeled as a manual approximation in a code comment when used.
- SHALL add `packages/ui/src/base/table.tsx` (`Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`) as a shadcn-style primitive — plain HTML + semantic Tailwind tokens, no Radix dependency (spec §4.2).
- SHALL add `packages/ui/src/base/checkbox.tsx` (`Checkbox`) as a shadcn-style primitive using `radix-ui`'s `Checkbox` export. SHALL NOT add a new dependency to do so — `radix-ui` (the consolidated package) already includes it (verify before writing code, Task 2/Step 1).
- SHALL add `packages/ui/src/base/pagination.tsx` (`Pagination`, `DataTablePaginationProps`) composing the existing `Button` primitive and `lucide-react` icons only. SHALL NOT add a shadcn `Select` primitive — page-size uses a plain `<select>` (spec §2, §5).
- SHALL rewrite `packages/ui/src/base/data-table.tsx` to render exclusively through `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`, `Checkbox`, and `Pagination`. SHALL NOT leave any hardcoded `slate-*` (or other non-token) color/border/background utility class in this file (spec §4.3, §7).
- SHALL keep `DataTableProps`'s existing fields (`columns`, `rows`, `rowKey`, `emptyMessage`, `loading`, `error`, `onRowClick`, `pagination`) unchanged in name and meaning. SHALL NOT change any of the nine non-Bookings consumer files (`admin`, `billing`, `catalog`, `catalog/add-ons`, `cleaners`, `cleaners/teams`, `customers`, `jobs`, `laundry` — eleven `<DataTable>` call sites across them, since `cleaners/teams/page.tsx` and `customers/page.tsx` each contain two; spec §4.1) — their code stays byte-identical; only their rendered output changes via `DataTable`'s internals.
- SHALL add `sort`/`onSortChange` (asc → desc → none cycle), `selection` (never pruning a `selectedKeys` entry outside the current page, nor a key for any row `isRowSelectable` currently excludes — only add/remove keys for rows on the current page that are selectable), and `toolbar` as new, optional `DataTableProps` fields (spec §4.2). SHALL NOT add a client-side `sortFn`/comparator prop, and SHALL NOT have `DataTable` reorder `rows` itself under any configuration (spec §3, §4.2). SHALL export the state-transition logic (`nextSortState`, `toggleSelectionKey`, `togglePageSelection`) as pure, directly-unit-testable functions from `data-table.tsx` — not inlined only as unexported closures — since `renderToStaticMarkup` cannot exercise them via a simulated click (Task 4).
- SHALL add `packages/ui/src/base/table.test.tsx`, `packages/ui/src/base/checkbox.test.tsx`, `packages/ui/src/base/pagination.test.tsx`, and extend `packages/ui/src/base/data-table.test.tsx` (new file — none exists today) covering the behavior enumerated in spec §7.
- SHALL add `vitest` + a `test` script + `vitest.config.ts` to `packages/web` (new; the package has none today), mirroring `packages/ui`'s existing wiring (spec §2, §7).
- SHALL add `packages/web/src/bookings/booking-data-table.tsx` exporting `BookingDataTable`, owning the seven Bookings columns and `formatScheduledAt` (moved from `apps/web/app/app/bookings/page.tsx`), taking a host-injected `formatPrice` callback (spec §4.4). SHALL NOT import `@clensy/client`, `@apollo/client`, or `next-intl` anywhere in `packages/web/src/` (spec §2, §4.4, existing `packages/web/README.md` boundary).
- SHALL NOT wire `sort`, `selection`, or `pagination.pageSizeOptions` into `BookingDataTable` or the Bookings page this slice (spec §2, §4.6).
- SHALL NOT add URL query-parameter synchronization for anything beyond the Bookings page's existing `?detail=<id>` param (spec §2, §4.6).
- SHALL NOT modify `apps/api/**`, `packages/validation/**`, `packages/client/**`, `packages/domain/**`, `packages/graphql/**`, `packages/auth/**`, `packages/config/**`, `packages/testing/**`, `apps/web/app/globals.css`, `apps/web/middleware.ts`, `apps/web/next.config.ts`, or any `apps/web` file other than `apps/web/app/app/bookings/page.tsx`.
- SHALL NOT introduce a `CustomerDataTable`, cross-page select-all, or Bookings-side toolbar wiring (spec §2, §6, §8 — all explicitly deferred).
- SHALL verify `useBookingsQuery`'s result is structurally assignable to `BookingDataTable`'s `Booking` type by direct assignment (no `as` cast) at the Bookings page call site, and SHALL NOT rely on a type assertion as proof of the M4 structural-pass-through decision (spec §4.4; Task 6/Step 2a). If assignment does not type-check, SHALL switch to spec §4.4's option 2 (an explicit mapping step) rather than forcing the cast.
- SHALL copy `apps/web/app/app/bookings/page.tsx`'s current `formatScheduledAt` implementation verbatim into `BookingDataTable` rather than reconstructing it from this plan's own code sample (Task 5/Step 4).
- SHALL record the pre-existing working-tree state before any edit (Task 0) and interpret every "zero diff" acceptance gate in Task 7 against that recorded baseline, not against an assumed-clean tree.

---

## File structure

| Path | Responsibility |
| --- | --- |
| `packages/ui/components.json` | New: shadcn CLI anchor for this package, pointed at `src/base` (establishes the workflow `packages/ui/README.md` deferred) |
| `packages/ui/src/base/table.tsx` | New: shadcn-generated (or, if network-unavailable, explicitly-labeled hand-authored fallback) `Table` primitive family |
| `packages/ui/src/base/table.test.tsx` | New: primitive markup/class contract test |
| `packages/ui/src/base/checkbox.tsx` | New: shadcn-generated (or explicitly-labeled fallback) `Checkbox` primitive |
| `packages/ui/src/base/checkbox.test.tsx` | New: checked/unchecked/indeterminate state test |
| `packages/ui/src/base/pagination.tsx` | New: `Pagination` component + `DataTablePaginationProps` |
| `packages/ui/src/base/pagination.test.tsx` | New: bounds-disabling and page-size-gating test |
| `packages/ui/src/base/data-table.tsx` | Rewritten: composes `Table`/`Checkbox`/`Pagination`; gains `sort`/`selection`/`toolbar` |
| `packages/ui/src/base/data-table.test.tsx` | New: sorting cycle, selection key-preservation, toolbar, empty/loading/error states |
| `packages/ui/src/index.ts` | Modified: exports `Table*`, `Checkbox`, `Pagination`/`DataTablePaginationProps` (moved from `data-table.tsx`), `DataTableSortState`, `DataTableSelectionProps` |
| `packages/web/package.json` | Modified: adds `vitest` devDependency + `test` script |
| `packages/web/vitest.config.ts` | New: mirrors `packages/ui/vitest.config.ts` |
| `packages/web/src/bookings/booking-data-table.tsx` | New: `BookingDataTable`, `Booking`, `BookingStatus`, `BookingDataTableProps` |
| `packages/web/src/bookings/booking-data-table.test.tsx` | New: column rendering, formatting, prop passthrough |
| `packages/web/src/index.ts` | Modified: adds `BookingDataTable` + its types |
| `apps/web/app/app/bookings/page.tsx` | Modified: renders `<BookingDataTable>`; removes `columns`, `BookingRow`, `formatScheduledAt` |

**Must remain untouched:** every file listed in Global Constraints' "SHALL NOT modify" bullet, all nine non-Bookings `DataTable` consumer files, `packages/ui/src/base/{avatar,button,dropdown-menu,separator,sheet,skeleton,tooltip,modal,form-field,status-badge,page-header,loading-state,empty-state,error-state,detail-drawer,toast,dialogs/*,field,input,label}.tsx` and their tests, `packages/web/src/auth/login-form.tsx`.

---

### Task 0: Capture the pre-existing working-tree baseline

**Files:** none — read-only.

The repository may already carry unrelated, pre-existing uncommitted changes when this plan starts executing (at spec-writing time, `workflow.yaml` and `.claude/skills/workflow/SKILL.md` had such a diff — an installer/workflow-package update unrelated to this ticket). Task 7's "zero diff" acceptance gate (spec §7) means *zero diff introduced by this plan*, not *a clean tree* — those are different claims, and conflating them would make the gate either falsely fail (flagging pre-existing noise as a regression) or falsely pass (if a script only checks "tree is clean" and pre-existing changes mask this plan's own unwanted edit). Establish the actual baseline before touching anything:

- [ ] **Step 1: Record the starting state**

```bash
git status --short > /tmp/data-table-plan-baseline-status.txt
git diff --stat > /tmp/data-table-plan-baseline-diff.txt
cat /tmp/data-table-plan-baseline-status.txt
```

- [ ] **Step 2: Note anything already present.** If the output is non-empty, write down exactly which files and confirm each is unrelated to this plan (e.g. by checking whether it's in this plan's own "Files" lists for any task) before proceeding. Do not stash or discard it — it is someone else's in-progress work, not this plan's to touch (per this repository's own safety conventions). Task 7/Step 3 diffs against this recorded baseline, not against an assumed-clean tree.

- [ ] **Step 3 (no commit — this task makes no edits).**

---

### Task 1: `Table` primitive

**Files:**
- Create: `packages/ui/src/base/table.tsx`, `packages/ui/src/base/table.test.tsx`

**Interfaces:**
- Produces: `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`

- [ ] **Step 1: Generate `Table` via the shadcn CLI first — do not hand-write source and call it "generated."** `packages/ui/README.md` (written in the boundary spec) explicitly deferred establishing this package's shadcn CLI workflow to "when the next primitive is actually needed" — that's now. Before writing any file:

```bash
ls packages/ui/components.json 2>&1   # expect "No such file or directory" — none exists yet
cat apps/web/components.json 2>&1 || echo "already deleted by the boundary-spec plan — check git log if needed for reference"
```

Create `packages/ui/components.json`, pointed at this package's own `src/base` (not `apps/web`), mirroring whatever shape the now-deleted `apps/web/components.json` used (check `git log -p -- apps/web/components.json` if it's not in the working tree) with paths/aliases updated to `packages/ui`'s own `tsconfig.json` and Tailwind config. Then run:

```bash
cd packages/ui
npx shadcn@latest add table
cd ../..
git diff --stat -- packages/ui/src/base/table.tsx  # confirm the CLI actually wrote the file
```

**If the execution sandbox has no network access to the shadcn registry** (a real possibility in a CI/agent sandbox), the CLI step fails — in that case, fall back to the hand-authored source in Step 2 below, but treat it explicitly as *a manually-authored approximation of what the CLI would generate*, not as verified CLI output, and leave a one-line code comment in the file itself noting this (`// Hand-authored approximation of shadcn's Table — reconcile against the CLI's actual output once network access is available; see plan Task 1, Step 1.`). Do not silently present it as generated either way — the distinction matters because a future actual CLI run should be expected to touch this file again, and a reviewer needs to know that's expected.

- [ ] **Step 2: Reconcile the generated (or, per Step 1's fallback, hand-authored) file against this plan's expected shape**, matching the coding style of the already-relocated shadcn primitives (`avatar.tsx`, `separator.tsx` — double-quoted strings, no semicolons, `data-slot` attributes, `cn` from `"cn"`; no `radix-ui` import needed here, this primitive is plain HTML). The CLI's actual output is authoritative over this snippet — this is what to expect and reconcile against, not what to blindly paste in if the two differ (e.g. in exact Tailwind utility strings, which drift across shadcn registry versions):

```tsx
import * as React from "react"
import { cn } from "cn"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-3 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("p-3 align-middle [&:has([role=checkbox])]:pr-0", className)}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption }
```

No `"use client"` directive — this file has no hooks, refs, or event-handler-only browser APIs of its own (matching `button.tsx`, which also omits it).

- [ ] **Step 3: Write `packages/ui/src/base/table.test.tsx`** (repository style: `vitest` + `react-dom/server`'s `renderToStaticMarkup`, no `jsdom`):

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

describe('Table primitive', () => {
  it('renders a table wrapped in a scroll container', () => {
    const html = renderToStaticMarkup(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alice</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(html).toContain('data-slot="table-container"');
    expect(html).toContain('<table');
    expect(html).toContain('Alice');
  });

  it('passes through className on every sub-component', () => {
    const html = renderToStaticMarkup(
      <Table className="custom-table">
        <TableHeader className="custom-header">
          <TableRow className="custom-row">
            <TableHead className="custom-head">H</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="custom-body">
          <TableRow>
            <TableCell className="custom-cell">C</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    for (const cls of ['custom-table', 'custom-header', 'custom-row', 'custom-head', 'custom-body', 'custom-cell']) {
      expect(html).toContain(cls);
    }
  });
});
```

- [ ] **Step 4: Verify**

```bash
pnpm --filter @clensy/ui test -- table
pnpm --filter @clensy/ui lint
pnpm --filter @clensy/ui build
```

- [ ] **Step 5 (no commit yet — leave working tree as-is for review).**

---

### Task 2: `Checkbox` primitive

**Files:**
- Create: `packages/ui/src/base/checkbox.tsx`, `packages/ui/src/base/checkbox.test.tsx`

**Interfaces:**
- Produces: `Checkbox`

- [ ] **Step 1: Confirm zero new dependency before writing code**

```bash
grep -n '"radix-ui"\|"lucide-react"' packages/ui/package.json
node -e "console.log(Object.keys(require('radix-ui')).filter(k => /checkbox/i.test(k)))" 2>/dev/null || true
```

Expect `radix-ui` and `lucide-react` already present in `packages/ui/package.json`'s `dependencies` (they are, per Task 1 of the boundary-spec plan) — this task adds no new `package.json` entry.

- [ ] **Step 2: Generate `Checkbox` via the shadcn CLI first**, using the `packages/ui/components.json` Task 1/Step 1 created:

```bash
cd packages/ui
npx shadcn@latest add checkbox
cd ../..
git diff --stat -- packages/ui/src/base/checkbox.tsx
```

Same network-unavailable fallback as Task 1/Step 1 applies: if the CLI can't reach the registry in this execution environment, use Step 3's hand-authored source below as an explicitly-labeled approximation (same one-line code-comment convention), not as verified CLI output.

- [ ] **Step 3: Reconcile the generated (or fallback hand-authored) file against this plan's expected shape**, matching `avatar.tsx`'s `"use client"` + `radix-ui`-unified-import style. The CLI's actual output is authoritative over this snippet:

```tsx
"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"
import { CheckIcon } from "lucide-react"
import { cn } from "cn"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs outline-none transition-shadow focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
```

Radix's `Checkbox.Root` accepts `checked: boolean | 'indeterminate'` and `onCheckedChange(checked)` directly — no manual DOM `.indeterminate` ref is needed (spec §4.2).

- [ ] **Step 4: Write `packages/ui/src/base/checkbox.test.tsx`**

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Checkbox } from './checkbox';

describe('Checkbox primitive', () => {
  it('renders unchecked by default', () => {
    const html = renderToStaticMarkup(<Checkbox aria-label="pick" />);
    expect(html).toContain('data-state="unchecked"');
  });

  it('renders checked state', () => {
    const html = renderToStaticMarkup(<Checkbox aria-label="pick" checked />);
    expect(html).toContain('data-state="checked"');
  });

  it('renders indeterminate state', () => {
    const html = renderToStaticMarkup(<Checkbox aria-label="pick" checked="indeterminate" />);
    expect(html).toContain('data-state="indeterminate"');
  });

  it('renders disabled state', () => {
    const html = renderToStaticMarkup(<Checkbox aria-label="pick" disabled />);
    expect(html).toContain('disabled');
  });
});
```

Run and confirm the exact `data-state` string Radix's `Checkbox.Root` emits for each `checked` value before trusting these assertions — this is a characterization test of Radix's own behavior, not new logic this plan writes.

- [ ] **Step 5: Verify**

```bash
pnpm --filter @clensy/ui test -- checkbox
pnpm --filter @clensy/ui lint
pnpm --filter @clensy/ui build
```

- [ ] **Step 6 (no commit yet — leave working tree as-is for review).**

---

### Task 3: `Pagination` component

**Files:**
- Create: `packages/ui/src/base/pagination.tsx`, `packages/ui/src/base/pagination.test.tsx`

**Interfaces:**
- Produces: `Pagination`, `DataTablePaginationProps` (canonical home moves here from `data-table.tsx`)

- [ ] **Step 1: Write `packages/ui/src/base/pagination.tsx`**. This is a **generic Clensy composition** (spec's own wording), not literal shadcn-CLI output — use this repository's regular code style (single quotes, semicolons, matching `data-table.tsx`/`error-state.tsx`), not the shadcn-generated files' style:

```tsx
import type { ChangeEvent } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from './button';

export interface DataTablePaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
}

export function Pagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
}: DataTablePaginationProps) {
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));

  function handlePageSizeChange(event: ChangeEvent<HTMLSelectElement>) {
    onPageSizeChange?.(Number(event.currentTarget.value));
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-sm text-muted-foreground">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeftIcon /> Previous
      </Button>
      <div className="flex items-center gap-3">
        <span>
          Page {page} of {pageCount}
        </span>
        {pageSizeOptions ? (
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={handlePageSizeChange}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option} / page
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Next <ChevronRightIcon />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Write `packages/ui/src/base/pagination.test.tsx`**

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Pagination } from './pagination';

// Extracts one <button>...</button> element by its aria-label, so an
// assertion about ITS disabled state can't accidentally match the OTHER
// button or depend on attribute-ordering within the tag (Button spreads
// `{...props}` after its own `data-*`/`className` attributes, so relying on
// "disabled appears before/after this text" in the raw string is fragile —
// this extraction sidesteps that entirely).
function extractButtonByLabel(html: string, label: string): string {
  const marker = `aria-label="${label}"`;
  const start = html.lastIndexOf('<button', html.indexOf(marker));
  const end = html.indexOf('</button>', start) + '</button>'.length;
  if (start === -1 || end === -1) throw new Error(`No <button aria-label="${label}"> found`);
  return html.slice(start, end);
}

describe('Pagination', () => {
  it('disables Previous on the first page, enables Next', () => {
    const html = renderToStaticMarkup(
      <Pagination page={1} pageSize={20} totalCount={100} onPageChange={() => {}} />,
    );
    expect(extractButtonByLabel(html, 'Previous page')).toContain('disabled');
    expect(extractButtonByLabel(html, 'Next page')).not.toContain('disabled');
  });

  it('enables Previous, disables Next on the last page', () => {
    const html = renderToStaticMarkup(
      <Pagination page={5} pageSize={20} totalCount={100} onPageChange={() => {}} />,
    );
    expect(extractButtonByLabel(html, 'Previous page')).not.toContain('disabled');
    expect(extractButtonByLabel(html, 'Next page')).toContain('disabled');
  });

  it('omits the page-size select when pageSizeOptions is not supplied', () => {
    const html = renderToStaticMarkup(
      <Pagination page={1} pageSize={20} totalCount={100} onPageChange={() => {}} />,
    );
    expect(html).not.toContain('<select');
  });

  it('renders the page-size select only when pageSizeOptions is supplied', () => {
    const html = renderToStaticMarkup(
      <Pagination
        page={1}
        pageSize={20}
        totalCount={100}
        onPageChange={() => {}}
        pageSizeOptions={[10, 20, 50]}
        onPageSizeChange={() => {}}
      />,
    );
    expect(html).toContain('<select');
    expect(html).toContain('50 / page');
  });
});
```

The second test is the regression gate protecting all eleven non-Bookings call sites, none of which pass `pageSizeOptions` (spec §4.1, §7).

- [ ] **Step 3: Verify**

```bash
pnpm --filter @clensy/ui test -- pagination
pnpm --filter @clensy/ui lint
pnpm --filter @clensy/ui build
```

- [ ] **Step 4 (no commit yet — leave working tree as-is for review).**

---

### Task 4: Rewrite `DataTable` to compose `Table`/`Checkbox`/`Pagination`, add sorting/selection/toolbar

**Files:**
- Modify: `packages/ui/src/base/data-table.tsx`, `packages/ui/src/index.ts`
- Create: `packages/ui/src/base/data-table.test.tsx`

**Interfaces:**
- Produces: `DataTableColumn` (adds `sortable`, `align`, `width`), `DataTableSortState` (new), `DataTableSelectionProps` (new), `DataTableProps` (adds `sort`, `onSortChange`, `selection`, `toolbar`); `DataTablePaginationProps`'s canonical export moves to `pagination.tsx` (Task 3) — `data-table.tsx` imports, does not redeclare, it.
- Consumes: `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` (Task 1), `Checkbox` (Task 2), `Pagination` (Task 3), existing `ErrorState`/`LoadingState`.

- [ ] **Step 1: Re-read the current `data-table.tsx` immediately before editing** — confirm it still matches what this plan was written against (the `rows`/`columns`/`rowKey`/`emptyMessage`/`loading`/`error`/`onRowClick`/`pagination` shape read at spec-writing time). If it has drifted, reconcile with the spec before proceeding rather than silently working from a stale assumption.

- [ ] **Step 2: Rewrite `packages/ui/src/base/data-table.tsx`**

```tsx
import type { KeyboardEvent, ReactNode } from 'react';
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from 'lucide-react';
import { Checkbox } from './checkbox';
import { ErrorState } from './error-state';
import { LoadingState } from './loading-state';
import { Pagination, type DataTablePaginationProps } from './pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface DataTableSortState {
  key: string;
  direction: 'asc' | 'desc';
}

export interface DataTableSelectionProps<T> {
  selectedKeys: string[];
  onSelectionChange: (keys: string[]) => void;
  isRowSelectable?: (row: T) => boolean;
}

export type { DataTablePaginationProps };

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  loading?: boolean;
  error?: string;
  onRowClick?: (row: T) => void;
  pagination?: DataTablePaginationProps;
  sort?: DataTableSortState | null;
  onSortChange?: (sort: DataTableSortState | null) => void;
  selection?: DataTableSelectionProps<T>;
  toolbar?: ReactNode;
}

const ALIGN_CLASS = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const satisfies Record<NonNullable<DataTableColumn<unknown>['align']>, string>;

export function nextSortState(
  current: DataTableSortState | null | undefined,
  key: string,
): DataTableSortState | null {
  if (!current || current.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc') return { key, direction: 'desc' };
  return null;
}

// Toggles a single row's key, preserving every other entry in `selectedKeys`
// untouched — including keys belonging to rows not currently rendered on
// this page. Pure and exported so the contract can be unit-tested directly,
// since renderToStaticMarkup cannot dispatch the click that would otherwise
// exercise it (spec §4.2, §5).
export function toggleSelectionKey(selectedKeys: string[], key: string): string[] {
  return selectedKeys.includes(key)
    ? selectedKeys.filter((existingKey) => existingKey !== key)
    : [...selectedKeys, key];
}

// Toggles "select all" for the current page. Contract (spec §4.2, §5, and
// M5 round-1 feedback): select-all only ever adds or removes keys in
// `selectableKeys` (the current page's *selectable* rows) — never a key
// belonging to another page, and never a key for a row on this page that
// `isRowSelectable` returned false for. A pre-existing selected key that
// happens to belong to a non-selectable row on this page (or another page
// entirely) is left exactly as-is either way.
export function togglePageSelection(
  selectedKeys: string[],
  selectableKeys: string[],
  allSelected: boolean,
): string[] {
  const withoutSelectablePageKeys = selectedKeys.filter((key) => !selectableKeys.includes(key));
  return allSelected ? withoutSelectablePageKeys : [...withoutSelectablePageKeys, ...selectableKeys];
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  rowKey,
  emptyMessage = 'No data.',
  loading = false,
  error,
  onRowClick,
  pagination,
  sort,
  onSortChange,
  selection,
  toolbar,
}: DataTableProps<T>) {
  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: T) {
    if (!onRowClick) return;
    if (event.key === 'Enter') {
      onRowClick(row);
    } else if (event.key === ' ') {
      event.preventDefault();
      onRowClick(row);
    }
  }

  const selectableKeys = selection
    ? rows.filter((row) => selection.isRowSelectable?.(row) ?? true).map(rowKey)
    : [];
  const selectedOnPage = selection
    ? selectableKeys.filter((key) => selection.selectedKeys.includes(key))
    : [];
  const allSelected = selection ? selectableKeys.length > 0 && selectedOnPage.length === selectableKeys.length : false;
  const someSelected = selection ? selectedOnPage.length > 0 && !allSelected : false;

  function toggleSelectAll() {
    if (!selection) return;
    selection.onSelectionChange(togglePageSelection(selection.selectedKeys, selectableKeys, allSelected));
  }

  function toggleRow(row: T) {
    if (!selection) return;
    selection.onSelectionChange(toggleSelectionKey(selection.selectedKeys, rowKey(row)));
  }

  function handleSortClick(column: DataTableColumn<T>) {
    if (!column.sortable) return;
    onSortChange?.(nextSortState(sort, column.key));
  }

  const colSpan = columns.length + (selection ? 1 : 0);

  return (
    <div>
      {toolbar ? <div className="flex items-center justify-between gap-3 pb-3">{toolbar}</div> : null}
      <Table>
        <TableHeader>
          <TableRow>
            {selection ? (
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Select all rows on this page"
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleSelectAll}
                  disabled={selectableKeys.length === 0}
                />
              </TableHead>
            ) : null}
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={ALIGN_CLASS[column.align ?? 'left']}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.sortable ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium"
                    onClick={() => handleSortClick(column)}
                  >
                    {column.header}
                    {sort?.key === column.key ? (
                      sort.direction === 'asc' ? (
                        <ArrowUpIcon className="size-3.5" />
                      ) : (
                        <ArrowDownIcon className="size-3.5" />
                      )
                    ) : (
                      <ChevronsUpDownIcon className="size-3.5 opacity-50" />
                    )}
                  </button>
                ) : (
                  column.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={colSpan}>
                <LoadingState />
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={colSpan}>
                <ErrorState message={error} />
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const key = rowKey(row);
              const rowSelectable = selection ? (selection.isRowSelectable?.(row) ?? true) : false;
              return (
                <TableRow
                  key={key}
                  data-state={selection?.selectedKeys.includes(key) ? 'selected' : undefined}
                  className={onRowClick ? 'cursor-pointer' : undefined}
                  {...(onRowClick
                    ? {
                        onClick: () => onRowClick(row),
                        onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => handleRowKeyDown(event, row),
                        role: 'button',
                        tabIndex: 0,
                      }
                    : {})}
                >
                  {selection ? (
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        aria-label="Select row"
                        checked={selection.selectedKeys.includes(key)}
                        onCheckedChange={() => toggleRow(row)}
                        disabled={!rowSelectable}
                      />
                    </TableCell>
                  ) : null}
                  {columns.map((column) => (
                    <TableCell key={column.key} className={ALIGN_CLASS[column.align ?? 'left']}>
                      {column.render ? column.render(row) : String(row[column.key] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      {pagination ? <Pagination {...pagination} /> : null}
    </div>
  );
}
```

Note the `TableCell`'s `onClick={(event) => event.stopPropagation()}` around the row checkbox — required so clicking the checkbox doesn't also trigger the row's `onRowClick` (relevant to any future consumer combining `selection` and `onRowClick`; no current consumer does both, so this has no visible effect on any of the ten screens today).

**M5 round-1 fix — select-all's selectable-row contract.** An earlier draft of this plan computed `withoutPage` by filtering out every key in `currentPageKeys` (all rows on the page, selectable or not). That has a real bug: if a row is not currently selectable (`isRowSelectable` returns `false`) but its key is already present in `selectedKeys` for some other reason, clicking "select all" would silently drop it — even though the header checkbox's own checked/indeterminate state never counted that row in the first place (it's computed from `selectableKeys` only). `togglePageSelection` above fixes this by filtering against `selectableKeys` (the current page's *selectable* rows only), so a pre-existing selection on a non-selectable row is left untouched by select-all in either direction. This is the precise contract: **select-all only ever adds or removes keys for rows on the current page that `isRowSelectable` allows; it never touches a key for any other row, on this page or another.**

- [ ] **Step 3: Rewrite `packages/ui/src/index.ts`'s `DataTable`-related lines**

```diff
- export { DataTable } from './base/data-table';
- export type { DataTableColumn, DataTableProps, DataTablePaginationProps } from './base/data-table';
+ export { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption } from './base/table';
+ export { Checkbox } from './base/checkbox';
+ export { Pagination } from './base/pagination';
+ export type { DataTablePaginationProps } from './base/pagination';
+ export { DataTable } from './base/data-table';
+ export type { DataTableColumn, DataTableProps, DataTableSortState, DataTableSelectionProps } from './base/data-table';
```

- [ ] **Step 4: Write `packages/ui/src/base/data-table.test.tsx`**

`renderToStaticMarkup` cannot dispatch click events, so every stateful transition (`sort` cycling, selection toggling) is tested two ways, per M5 round-1 feedback: a **pure-function test** of the exported transition logic (`nextSortState`, `toggleSelectionKey`, `togglePageSelection`) exercising the actual state transitions, and a separate **rendering-only test** confirming the markup reflects a given state correctly — never one flawed test trying to do both.

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DataTable,
  nextSortState,
  toggleSelectionKey,
  togglePageSelection,
  type DataTableColumn,
} from './data-table';

interface Row extends Record<string, unknown> {
  id: string;
  name: string;
}

const sortableColumns: DataTableColumn<Row>[] = [{ key: 'name', header: 'Name', sortable: true }];
const mixedColumns: DataTableColumn<Row>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'id', header: 'ID' },
];
const rows: Row[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
];

describe('nextSortState (pure)', () => {
  it('cycles none → asc → desc → none for the same key', () => {
    expect(nextSortState(null, 'name')).toEqual({ key: 'name', direction: 'asc' });
    expect(nextSortState({ key: 'name', direction: 'asc' }, 'name')).toEqual({ key: 'name', direction: 'desc' });
    expect(nextSortState({ key: 'name', direction: 'desc' }, 'name')).toBeNull();
  });

  it('resets to asc when a different column is clicked', () => {
    expect(nextSortState({ key: 'other', direction: 'desc' }, 'name')).toEqual({ key: 'name', direction: 'asc' });
  });
});

describe('toggleSelectionKey (pure)', () => {
  it('adds a key that is not yet selected', () => {
    expect(toggleSelectionKey(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('removes a key that is already selected, preserving the rest', () => {
    expect(toggleSelectionKey(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });
});

describe('togglePageSelection (pure) — the M5 round-1 contract', () => {
  it('selecting all adds the current page\'s selectable keys without disturbing an existing out-of-page key', () => {
    const selectedKeys = ['other-page-row'];
    const selectableKeys = ['row-1', 'row-2'];
    const result = togglePageSelection(selectedKeys, selectableKeys, false);
    expect(result).toEqual(expect.arrayContaining(['other-page-row', 'row-1', 'row-2']));
    expect(result).toHaveLength(3);
  });

  it('deselecting all removes only the current page\'s selectable keys, preserving an out-of-page key', () => {
    const selectedKeys = ['other-page-row', 'row-1', 'row-2'];
    const selectableKeys = ['row-1', 'row-2'];
    expect(togglePageSelection(selectedKeys, selectableKeys, true)).toEqual(['other-page-row']);
  });

  it('never removes a selected key belonging to a non-selectable row on the current page', () => {
    // row-2 is selected despite not being in `selectableKeys` (e.g. it became
    // non-selectable after being selected) — select-all must leave it alone
    // in either direction, since it was never counted toward `allSelected`.
    const selectedKeys = ['row-2'];
    const selectableKeys = ['row-1']; // row-2 excluded — not selectable
    expect(togglePageSelection(selectedKeys, selectableKeys, false)).toEqual(['row-2', 'row-1']);
    expect(togglePageSelection(selectedKeys, selectableKeys, true)).toEqual(['row-2']);
  });
});

describe('DataTable', () => {
  it('renders rows and columns through the Table primitive', () => {
    const html = renderToStaticMarkup(<DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} />);
    expect(html).toContain('data-slot="table"');
    expect(html).toContain('Alice');
    expect(html).toContain('Bob');
  });

  it('renders the empty message when rows is empty', () => {
    const html = renderToStaticMarkup(
      <DataTable columns={sortableColumns} rows={[]} rowKey={(r) => r.id} emptyMessage="Nothing here." />,
    );
    expect(html).toContain('Nothing here.');
  });

  it('renders LoadingState when loading', () => {
    const html = renderToStaticMarkup(<DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} loading />);
    expect(html).not.toContain('Alice');
  });

  it('renders ErrorState when error is set', () => {
    const html = renderToStaticMarkup(
      <DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} error="Failed." />,
    );
    expect(html).toContain('Failed.');
  });

  it('never reorders rows regardless of sort state (rendering contract)', () => {
    const html = renderToStaticMarkup(
      <DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} sort={{ key: 'name', direction: 'desc' }} />,
    );
    expect(html.indexOf('Alice')).toBeLessThan(html.indexOf('Bob'));
  });

  it('renders a clickable header only for sortable columns, not for plain ones', () => {
    const html = renderToStaticMarkup(<DataTable columns={mixedColumns} rows={rows} rowKey={(r) => r.id} />);
    const nameHeaderIndex = html.indexOf('Name');
    const idHeaderIndex = html.indexOf('>ID<');
    expect(html.lastIndexOf('<button', nameHeaderIndex)).toBeGreaterThan(-1);
    // "ID"'s header cell renders the header text directly, with no <button>
    // between its own <TableHead> open tag and the text itself.
    const idCellStart = html.lastIndexOf('<th', idHeaderIndex);
    expect(html.slice(idCellStart, idHeaderIndex)).not.toContain('<button');
  });

  it('shows the neutral icon when unsorted, and the matching directional icon when sorted', () => {
    const unsorted = renderToStaticMarkup(<DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} sort={null} />);
    const ascending = renderToStaticMarkup(
      <DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} sort={{ key: 'name', direction: 'asc' }} />,
    );
    const descending = renderToStaticMarkup(
      <DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} sort={{ key: 'name', direction: 'desc' }} />,
    );
    // Exact icon component names as rendered by lucide-react — confirm against
    // the actual rendered SVG class/data attribute at execution time rather
    // than assuming these substrings if lucide-react's SSR output differs.
    expect(unsorted).not.toEqual(ascending);
    expect(unsorted).not.toEqual(descending);
    expect(ascending).not.toEqual(descending);
  });

  it('renders a select-all checkbox and per-row checkboxes when selection is set', () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={sortableColumns}
        rows={rows}
        rowKey={(r) => r.id}
        selection={{ selectedKeys: ['1'], onSelectionChange: () => {} }}
      />,
    );
    expect((html.match(/data-slot="checkbox"/g) ?? []).length).toBe(rows.length + 1);
  });

  it('renders toolbar content when supplied', () => {
    const html = renderToStaticMarkup(
      <DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} toolbar={<span>Search</span>} />,
    );
    expect(html).toContain('Search');
  });

  it('omits the page-size select for a pagination prop without pageSizeOptions (regression gate for the eleven untouched non-Bookings call sites)', () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={sortableColumns}
        rows={rows}
        rowKey={(r) => r.id}
        pagination={{ page: 1, pageSize: 20, totalCount: 2, onPageChange: () => {} }}
      />,
    );
    expect(html).not.toContain('<select');
  });
});
```

The "shows the neutral icon..." test deliberately asserts the three renders are pairwise distinct rather than matching a specific icon substring — pin down the exact `lucide-react` SSR markup by running the test once and reading its actual output before tightening the assertion further, rather than guessing the substring here.

- [ ] **Step 5: Verify**

```bash
pnpm --filter @clensy/ui test
pnpm --filter @clensy/ui lint
pnpm --filter @clensy/ui build
```

Do **not** run `pnpm --filter web build` yet — all ten `apps/web` screens (twelve call sites) still compile against the unchanged `DataTableProps` shape, so this is expected to keep passing, but Task 6 is where the one call site this plan actually edits gets verified end to end.

- [ ] **Step 6: Quick compile-only sanity check against one untouched consumer** (does not modify it):

```bash
pnpm --filter web exec tsc --noEmit -p . 2>&1 | grep -i "data-table\|DataTable" || echo "no DataTable-related errors"
```

- [ ] **Step 7 (no commit yet — leave working tree as-is for review).**

---

### Task 5: `packages/web` test wiring and `BookingDataTable`

**Files:**
- Modify: `packages/web/package.json`, `packages/web/src/index.ts`
- Create: `packages/web/vitest.config.ts`, `packages/web/src/bookings/booking-data-table.tsx`, `packages/web/src/bookings/booking-data-table.test.tsx`

**Interfaces:**
- Produces: `BookingDataTable`, `Booking`, `BookingStatus`, `BookingDataTableProps`

- [ ] **Step 1: Re-verify `vitest`'s version before pinning it**

```bash
grep -n '"vitest"' packages/ui/package.json
```

Use exactly what this prints for `packages/web/package.json`'s new `devDependency`, for consistency with the rest of the monorepo (same approach the boundary-spec plan's Task 1 took for its own dependency versions).

- [ ] **Step 2: Edit `packages/web/package.json`** — add `"test": "vitest run"` to `scripts` and `vitest` to `devDependencies`.

- [ ] **Step 3: Write `packages/web/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 4: Read `apps/web/app/app/bookings/page.tsx`'s current `BookingRow` type, `columns` array, and `formatScheduledAt` immediately before writing `BookingDataTable`** — this plan was written against a specific snapshot of that file; re-confirm the seven columns (Customer, Property, Service, Scheduled, Status, Team, Price) and their exact `render` logic haven't drifted since. **Copy `formatScheduledAt`'s current implementation verbatim into `booking-data-table.tsx` — do not retype it from memory or from this plan's Step 5 snippet.** This is a behavior-preserving refactor (spec §4.4, §4.6): date formatting has enough locale/timezone subtlety that even a seemingly-equivalent reconstruction is a behavior change this plan doesn't have license to make. If the actual current implementation differs at all from the one shown in Step 5 below, use the actual one and note the discrepancy — Step 5's snippet was correct as of this plan's writing but is not the source of truth at execution time.

- [ ] **Step 5: Write `packages/web/src/bookings/booking-data-table.tsx`**

```tsx
import { DataTable, type DataTableColumn, type DataTablePaginationProps } from '@clensy/ui';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export interface Booking {
  id: string;
  scheduledAt: unknown;
  status: BookingStatus;
  pricingSnapshot: { priceMinorUnits: number };
  customer: { id: string; fullName: string };
  property: { id: string; addressLine1: string };
  service: { id: string; name: string };
  team: { id: string; name: string } | null;
  [key: string]: unknown;
}

export interface BookingDataTableProps {
  bookings: Booking[];
  formatPrice: (minorUnits: number) => string;
  loading?: boolean;
  error?: string;
  onRowClick?: (booking: Booking) => void;
  pagination: DataTablePaginationProps;
}

function formatScheduledAt(value: unknown): string {
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

export function BookingDataTable({
  bookings,
  formatPrice,
  loading,
  error,
  onRowClick,
  pagination,
}: BookingDataTableProps) {
  const columns: DataTableColumn<Booking>[] = [
    { header: 'Customer', key: 'customer', render: (row) => row.customer.fullName },
    { header: 'Property', key: 'property', render: (row) => row.property.addressLine1 },
    { header: 'Service', key: 'service', render: (row) => row.service.name },
    { header: 'Scheduled', key: 'scheduledAt', render: (row) => formatScheduledAt(row.scheduledAt) },
    { header: 'Status', key: 'status', render: (row) => row.status },
    { header: 'Team', key: 'team', render: (row) => row.team?.name ?? 'Unassigned' },
    {
      header: 'Price',
      key: 'price',
      render: (row) => formatPrice(row.pricingSnapshot.priceMinorUnits),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={bookings}
      rowKey={(row) => row.id}
      emptyMessage="No bookings."
      loading={loading}
      error={error}
      onRowClick={onRowClick}
      pagination={pagination}
    />
  );
}
```

`Booking`'s `[key: string]: unknown` index signature is carried over from today's `BookingRow` — required because `DataTable<T>` constrains `T extends Record<string, unknown>` (the same comment already present at every other `DataTable` consumer in `apps/web`, e.g. `admin/page.tsx`).

- [ ] **Step 6: Write `packages/web/src/bookings/booking-data-table.test.tsx`**

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BookingDataTable, type Booking } from './booking-data-table';

const booking: Booking = {
  id: 'b1',
  scheduledAt: '2026-09-19T10:00:00.000Z',
  status: 'CONFIRMED',
  pricingSnapshot: { priceMinorUnits: 12345 },
  customer: { id: 'c1', fullName: 'Jane Doe' },
  property: { id: 'p1', addressLine1: '123 Main St' },
  service: { id: 's1', name: 'Deep Clean' },
  team: { id: 't1', name: 'Team A' },
};

const pagination = { page: 1, pageSize: 20, totalCount: 1, onPageChange: () => {} };

describe('BookingDataTable', () => {
  it('renders every column value, formatting price via the injected callback', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[booking]}
        formatPrice={(minorUnits) => `₱${(minorUnits / 100).toFixed(2)}`}
        pagination={pagination}
      />,
    );
    expect(html).toContain('Jane Doe');
    expect(html).toContain('123 Main St');
    expect(html).toContain('Deep Clean');
    expect(html).toContain('CONFIRMED');
    expect(html).toContain('Team A');
    expect(html).toContain('₱123.45');
  });

  it('renders "Unassigned" when team is null', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[{ ...booking, team: null }]}
        formatPrice={() => '₱0.00'}
        pagination={pagination}
      />,
    );
    expect(html).toContain('Unassigned');
  });

  it('passes pagination through to the underlying DataTable', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[booking]}
        formatPrice={() => '₱0.00'}
        pagination={{ page: 2, pageSize: 20, totalCount: 40, onPageChange: () => {} }}
      />,
    );
    expect(html).toContain('Page 2 of 2');
  });
});
```

- [ ] **Step 7: Add `packages/web/src/index.ts`'s new export**

```diff
  export { LoginForm } from './auth/login-form';
  export type { LoginFormLabels, LoginFormProps, LoginFormValues } from './auth/login-form';
+ export { BookingDataTable } from './bookings/booking-data-table';
+ export type { Booking, BookingStatus, BookingDataTableProps } from './bookings/booking-data-table';
```

- [ ] **Step 8: Install and verify**

```bash
pnpm install
pnpm --filter @clensy/web lint
pnpm --filter @clensy/web build
pnpm --filter @clensy/web test
```

Confirm no `@clensy/client`, `@apollo/client`, or `next-intl` import was introduced:

```bash
grep -rn "@clensy/client\|@apollo/client\|next-intl" packages/web/src
```

Expect no output.

- [ ] **Step 9 (no commit yet — leave working tree as-is for review).**

---

### Task 6: Refactor `apps/web/app/app/bookings/page.tsx`

**Files:**
- Modify: `apps/web/app/app/bookings/page.tsx`

**Interfaces:** none new — this task only changes how the existing page composes its table.

- [ ] **Step 1: Remove the page's own `columns`, `BookingRow`, and `formatScheduledAt`**, and the now-unused `DataTable`/`DataTableColumn` import from `@clensy/ui`:

```diff
- import {
-   Button,
-   ConfirmDialog,
-   DataTable,
-   DetailDrawer,
-   ErrorState,
-   FormDialog,
-   FormField,
-   LoadingState,
-   PageHeader,
-   useToast,
- } from '@clensy/ui';
- import type { DataTableColumn } from '@clensy/ui';
+ import {
+   Button,
+   ConfirmDialog,
+   DetailDrawer,
+   ErrorState,
+   FormDialog,
+   FormField,
+   LoadingState,
+   PageHeader,
+   useToast,
+ } from '@clensy/ui';
+ import { BookingDataTable } from '@clensy/web';
```

Delete the `BookingRow` type, `formatScheduledAt` function, and the `columns` array from `BookingsPageContent` — all now live in `BookingDataTable` (Task 5).

- [ ] **Step 2: Replace the `<DataTable ... />` call**

```diff
-      <DataTable
-        columns={columns}
-        rows={rows}
-        rowKey={(row) => row.id}
-        emptyMessage="No bookings."
-        loading={loading}
-        error={error ? 'Unable to load bookings.' : undefined}
-        onRowClick={(row) => openDetail(row.id)}
-        pagination={{
-          onPageChange: setPage,
-          page,
-          pageSize,
-          totalCount: data?.bookings.totalCount ?? 0,
-        }}
-      />
+      <BookingDataTable
+        bookings={rows}
+        formatPrice={formatMinorUnits}
+        loading={loading}
+        error={error ? 'Unable to load bookings.' : undefined}
+        onRowClick={(booking) => openDetail(booking.id)}
+        pagination={{
+          onPageChange: setPage,
+          page,
+          pageSize,
+          totalCount: data?.bookings.totalCount ?? 0,
+        }}
+      />
```

**Step 2a: verify assignability — do not just carry the `as` cast forward.** The existing line is `const rows: BookingRow[] = (data?.bookings.nodes ?? []) as BookingRow[];` — a type assertion, which proves nothing about whether `useBookingsQuery`'s actual generated result type is structurally compatible with `Booking` (the M4 planning decision, spec §4.4, was to rely on structural compatibility, not on forcing an assertion through). Before deciding this is safe:

1. First attempt the assignment **without** a cast: `const rows: Booking[] = data?.bookings.nodes ?? [];`, importing `Booking` as a type from `@clensy/web`.
2. Run `pnpm --filter web exec tsc --noEmit -p .` and read the actual error, if any, at this line.
3. **If it type-checks with no cast:** structural pass-through holds — keep it exactly like this (no `as`), which is the actual proof this plan's M4 decision needs, not merely "the field names look similar."
4. **If it does not type-check:** stop here rather than reaching for `as Booking[]` to force it through — a needed cast is the concrete signal that spec §4.4's option 1 doesn't actually hold for the real generated type. Inspect the specific mismatch (e.g. a nullable field, a branded/opaque `id` type, an extra required field `Booking` doesn't declare) and switch to spec §4.4's option 2: add a small mapping step here (`const rows: Booking[] = (data?.bookings.nodes ?? []).map((node) => ({ ...node }));` or a more precise per-field map, depending on the actual mismatch) rather than papering over a real structural gap with an assertion. This is a deviation from this plan's Step 5 code (Task 5) only in this one assignment line — `BookingDataTable`'s own `Booking` interface and the rest of its contract are unaffected either way.

- [ ] **Step 3: Verify no other reference to the removed identifiers remains**

```bash
grep -n "BookingRow\|formatScheduledAt\|columns" apps/web/app/app/bookings/page.tsx
```

Expect no output (formatScheduledAt/columns/BookingRow all fully removed; if `columns` still appears, it's a leftover reference to find and fix).

- [ ] **Step 4: Install and verify**

```bash
pnpm install
pnpm --filter web lint
pnpm --filter web build
```

- [ ] **Step 5 (no commit yet — leave working tree as-is for review).**

---

### Task 7: Full verification

**Files:** none new unless a compatibility fix surfaces (then the smallest change to the affected file, called out explicitly rather than folded silently into this task).

- [ ] **Step 1: Grep-verifiable acceptance gates (spec §7)**

```bash
grep -n "slate-" packages/ui/src/base/data-table.tsx
git diff --stat -- apps/web/app/app/admin apps/web/app/app/billing apps/web/app/app/catalog apps/web/app/app/cleaners apps/web/app/app/customers apps/web/app/app/jobs apps/web/app/app/laundry
grep -rn "@clensy/client\|@apollo/client\|next-intl" packages/web/src
```

Expect: the first prints nothing (no hardcoded slate classes left in `data-table.tsx`); the second prints nothing beyond whatever pre-existing, unrelated diff Task 0 already recorded (zero *new* diff to the nine non-Bookings consumer directories' own files); the third prints nothing.

- [ ] **Step 2: Full monorepo checks**

```bash
pnpm --filter @clensy/ui lint
pnpm --filter @clensy/ui build
pnpm --filter @clensy/ui test
pnpm --filter @clensy/web lint
pnpm --filter @clensy/web build
pnpm --filter @clensy/web test
pnpm --filter web lint
pnpm --filter web build
```

- [ ] **Step 3: Scope check against Task 0's baseline, not against an assumed-clean tree**

```bash
git status --short
diff /tmp/data-table-plan-baseline-status.txt <(git status --short) || true
git diff --stat -- apps/api packages/validation packages/client packages/domain packages/graphql packages/auth packages/config packages/testing apps/web/app/globals.css apps/web/middleware.ts apps/web/next.config.ts apps/web/app/app/admin apps/web/app/app/billing apps/web/app/app/catalog apps/web/app/app/cleaners apps/web/app/app/customers apps/web/app/app/jobs apps/web/app/app/laundry
git diff --cached --stat -- apps/api packages/validation packages/client packages/domain packages/graphql packages/auth packages/config packages/testing apps/web/app/globals.css apps/web/middleware.ts apps/web/next.config.ts apps/web/app/app/admin apps/web/app/app/billing apps/web/app/app/catalog apps/web/app/app/cleaners apps/web/app/app/customers apps/web/app/app/jobs apps/web/app/app/laundry
```

The `diff` against `/tmp/data-table-plan-baseline-status.txt` shows exactly what this plan's own tasks changed, on top of whatever pre-existing baseline Task 0 recorded — that's the actual claim "this plan touched nothing outside its own file list" makes, not "the tree started clean." Expect both `git diff --stat` commands (now covering both the never-touch list and all nine non-Bookings consumer directories explicitly) to print nothing beyond what was already present in the Task 0 baseline.

- [ ] **Step 4: Manual golden path** (spec §7) — start the dev server (`pnpm --filter web dev`) and confirm:
  1. **Bookings** (`/app/bookings`): list renders with the new `Table`-based markup; pagination Previous/Next work; row click opens the detail drawer; create/edit/delete/create-job flows all behave exactly as before.
  2. **Each of the other nine screens** (`/app/admin`, `/app/billing`, `/app/catalog`, `/app/catalog/add-ons`, `/app/cleaners`, `/app/cleaners/teams`, `/app/customers`, `/app/jobs`, `/app/laundry`): same columns, same data, same pagination and row-click behavior as before — appearance changes (border/spacing/hover, now token-based) but nothing else does.

- [ ] **Step 5: N/A unless Step 1–4 surfaced a fix — if so, note what broke and why, as its own reviewable change.**

---

## Spec coverage

| Spec | Task |
| --- | --- |
| `Table`/`Checkbox`/`Pagination` primitives, zero new dependency (§4.2) | 1, 2, 3 |
| `DataTable` composes primitives, no primitive markup of its own (§4.3) | 4 |
| `DataTableColumn`/`sort`/`onSortChange`/`selection`/`toolbar` additions, sort cycle, never-prune selection contract (§4.2, §5) | 4 |
| Ten-screen/twelve-call-site inventory; zero code change to the nine non-Bookings screens (§4.1) | 4 (verified by omission), 7 |
| `BookingDataTable` contract, boundary compliance, structural `Booking` pass-through verified (not assumed) via uncast assignability (M4 decision, §4.4) | 5, 6 |
| Bookings page refactor, `formatScheduledAt` copied verbatim (§4.5) | 6 |
| Pre-existing working-tree baseline captured and used as the acceptance-gate reference, not an assumed-clean tree | 0, 7 |
| Preserve-behavior semantics: no URL sync beyond `?detail=`, no sort/selection/page-size enabled for Bookings (§4.6) | 5, 6 (verified by omission) |
| Testing/acceptance: primitive tests, `DataTable` tests, `BookingDataTable` tests, grep gates, build gates, manual golden path (§7) | 1, 2, 3, 4, 5, 7 |
| Non-goals: no shadcn `Select`, no Bookings adoption of new capabilities, no `CustomerDataTable`, no cross-page select-all, no code change to other consumers (§8) | 7 (verified by omission) |

## Type consistency

- `Table`/`TableHeader`/`TableBody`/`TableFooter`/`TableRow`/`TableHead`/`TableCell`/`TableCaption` — Task 1, consumed by `DataTable` (Task 4)
- `Checkbox` — Task 2, consumed by `DataTable`'s selection column (Task 4)
- `Pagination`/`DataTablePaginationProps` — Task 3; `DataTablePaginationProps`'s canonical export moves here from `data-table.tsx` (Task 4, Step 3); consumed by `DataTable` and re-exported from `index.ts`
- `DataTableColumn`/`DataTableProps`/`DataTableSortState`/`DataTableSelectionProps` — Task 4, re-exported from `index.ts`
- `nextSortState`/`toggleSelectionKey`/`togglePageSelection` — Task 4, exported from `data-table.tsx` (module-local, not re-exported from `index.ts` — test-only public surface, not part of `@clensy/ui`'s package API) and imported directly by `data-table.test.tsx`
- `Booking`/`BookingStatus`/`BookingDataTableProps` — Task 5, `packages/web`-local, never imported from `@clensy/client`; consumed by `apps/web/app/app/bookings/page.tsx` (Task 6) via **verified** (Task 6/Step 2a, uncast assignment) structural compatibility with `useBookingsQuery`'s result, not an explicit import chain and not merely assumed from field-name similarity
