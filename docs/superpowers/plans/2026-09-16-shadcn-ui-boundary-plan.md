# `@clensy/ui` as the Shared UI System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relocate all seven existing shadcn primitives (`avatar`, `button`, `dropdown-menu`, `separator`, `sheet`, `skeleton`, `tooltip`) from `apps/web/components/ui/` into `packages/ui/src/base/`, alongside `@clensy/ui`'s existing compositions (also reorganized into `base/`, plus a `base/dialogs/` subfolder); collapse `@clensy/ui`'s hardcoded `Button` and the relocated shadcn `Button` into one component; update every consumer (the pre-existing `@clensy/ui` consumers and the three app-shell files that bypassed it) to import only from `@clensy/ui`; delete `apps/web/components/ui/*` and its shadcn CLI anchor; scaffold an empty `packages/ui/src/domain/`.

**Architecture:** `packages/ui` becomes the sole owner of the shared UI system — shadcn/`radix-ui`/`class-variance-authority` become real `packages/ui` dependencies, not `apps/web` ones. `base/` is flat (primitives and generic compositions together); `domain/` is reserved and empty; `internal/` is unchanged. `apps/web` gains no new UI-specific dependency and loses `radix-ui`/`class-variance-authority` entirely (verified zero other use); it keeps `cn`/`lucide-react` for its own non-primitive needs.

**Tech Stack:** TypeScript (existing `packages/ui/tsconfig.json`, unchanged), Vitest (new setup for this package — mirrors `packages/validation`'s the only existing `packages/*` precedent), Next.js/Tailwind 4 build already scanning `packages/ui/src` (unchanged, no config edit needed).

**Spec:** [docs/superpowers/specs/2026-09-16-shadcn-ui-boundary-design.md](../specs/2026-09-16-shadcn-ui-boundary-design.md) (Accepted, M3 2026-09-16). Where this plan and the spec disagree, the spec wins — stop and return to M2/M3 rather than resolving the conflict here.

**M5 decision:** **Accepted** — 2026-09-16. Two review rounds: round 1 required `react-dom`/`@types/react-dom` test dependencies, deriving the `Button` test's variant/size/token-class assertions from the relocated file at execution time rather than from literals in this plan, adding explicit size coverage, softening `index.test.ts`'s framing to runner-wiring smoke coverage only, fixing Task 5's clean-tree check (working tree + index, not the meaningless `main...HEAD`), a wording fix ("five" not "six" primitives), separating the `danger`→`destructive` renames from `form-dialog.tsx`'s unrelated `primary` removal in the global constraints, and marking Task 2's expected `apps/web` build failure as an intentional, non-diagnosable checkpoint. All applied. No remaining executability or traceability blocker. Ready for M6 implementation.

**Also relies on (Accepted, unmodified by this plan):** [Web Shell & Design System](../specs/2026-09-10-web-shell-and-design-system-design.md) (the seven primitives' existing implementation, the semantic Tailwind tokens they consume, `ShellChrome`/`BrandMark`/theme resolution — none of this plan's tasks touch shell layout or token values). [`@clensy/validation`](../specs/2026-09-15-clensy-validation-design.md) (`FormField`'s `error?: string` contract, unchanged by this plan's relocation of `form-field.tsx`).

---

## Global Constraints

- SHALL relocate all seven primitives (`avatar.tsx`, `button.tsx`, `dropdown-menu.tsx`, `separator.tsx`, `sheet.tsx`, `skeleton.tsx`, `tooltip.tsx`) from `apps/web/components/ui/` into `packages/ui/src/base/` behaviorally unchanged — markup, props, variants, and rendered output identical; only package-local import paths and dependency resolution may change (spec §3's precise definition of "verbatim").
- SHALL make `packages/ui/src/base/button.tsx` (the relocated shadcn primitive) the **only** `Button` exported from `@clensy/ui`. SHALL NOT keep, reintroduce, or wrap the old hardcoded `danger`/`primary`/`secondary` `Button` (spec §4.4).
- SHALL rename the three `variant="danger"` occurrences — `apps/web/app/app/admin/page.tsx:161`, `apps/web/app/app/bookings/page.tsx:536`, `packages/ui/src/confirm-dialog.tsx:50` (→ `base/dialogs/confirm-dialog.tsx`) — to `variant="destructive"`. `packages/ui/src/form-dialog.tsx`'s existing `variant="primary"` (→ `base/dialogs/form-dialog.tsx`) is separately removed (not renamed) because `default` is now the implicit default and the two are equivalent — this is the one other `Button`-prop edit this plan makes. SHALL NOT modify any `variant="secondary"` usage or any other unlabeled/default-variant `<Button>` usage (spec §4.6, grep-verified — zero other `variant="primary"` exists to touch).
- SHALL add `radix-ui`, `class-variance-authority`, `cn`, `lucide-react` to `packages/ui/package.json` as real `dependencies` (not `devDependencies`), at the versions currently pinned in `apps/web/package.json` (`radix-ui@^1.6.7`, `class-variance-authority@^0.7.1`, `cn@^0.2.6`, `lucide-react@^1.43.0`) — re-confirm each against `apps/web/package.json` immediately before editing, in case it has drifted since spec-writing. SHALL NOT add any other new runtime dependency to `packages/ui`.
- SHALL NOT add `jsdom`, `@testing-library/react`, or any component-rendering test framework anywhere in the repository (spec §2, §7).
- SHALL update `dashboard-layout.tsx`, `app-sidebar.tsx`, `user-menu.tsx` to import every primitive they use from `@clensy/ui` — SHALL NOT change their markup, props, or behavior beyond the import statement (spec §4.5).
- SHALL delete `apps/web/components/ui/*` entirely once every consumer is migrated. SHALL NOT leave a re-export shim at any path under `apps/web/components/ui/` (spec §1, §7's grep gate).
- SHALL remove `radix-ui` and `class-variance-authority` from `apps/web/package.json` (verify zero remaining consumer immediately before removing — re-run the grep from spec §4.3, do not rely on the spec's cached result). SHALL keep `cn` and `lucide-react` in `apps/web/package.json` (spec §4.3).
- SHALL delete `apps/web/components.json` (the shadcn CLI anchor) once `apps/web/components/ui/*` is deleted — SHALL NOT leave it pointed at a directory that no longer exists (spec §4.3's normative requirement; see Task 3 for the documented fallback workflow, which is a planning decision, not a spec requirement).
- SHALL NOT add a shadcn `Dialog` primitive. SHALL NOT migrate `Modal`, `FormDialog`, or `ConfirmDialog` onto one. SHALL NOT migrate `DetailDrawer` onto `Sheet` (spec §2, §8 — both are followed-by items, not this slice).
- SHALL NOT populate `packages/ui/src/domain/` with any component — scaffold (directory + short README) only (spec §2, §5, §8).
- SHALL NOT add a `no-restricted-imports` (or equivalent) lint rule (spec §2, §6, §8 — deferred).
- SHALL NOT modify `apps/web/app/globals.css` or any theme-token value (spec §4.7, §8).
- SHALL NOT add new variants, sizes, or props to any relocated primitive beyond what it already has today (spec §8).
- SHALL NOT modify `apps/api/**`, `packages/validation/**`, `packages/client/**`, or any `apps/web` page file other than the two named `danger`→`destructive` renames.

---

## File structure

| Path | Responsibility |
| --- | --- |
| `packages/ui/package.json` | Gains `radix-ui`, `class-variance-authority`, `cn`, `lucide-react` (dependencies) + `vitest` (devDependency) + `test` script |
| `packages/ui/vitest.config.ts` | New: `environment: 'node'`, `include: ['src/**/*.test.{ts,tsx}']` |
| `packages/ui/src/index.test.ts` | New: package smoke test (Task 1) |
| `apps/web/components/ui/avatar.tsx` → `packages/ui/src/base/avatar.tsx` | Relocated shadcn primitive, unchanged |
| `apps/web/components/ui/button.tsx` → `packages/ui/src/base/button.tsx` | Relocated shadcn primitive, unchanged; becomes the only `Button` |
| `apps/web/components/ui/dropdown-menu.tsx` → `packages/ui/src/base/dropdown-menu.tsx` | Relocated shadcn primitive, unchanged |
| `apps/web/components/ui/separator.tsx` → `packages/ui/src/base/separator.tsx` | Relocated shadcn primitive, unchanged |
| `apps/web/components/ui/sheet.tsx` → `packages/ui/src/base/sheet.tsx` | Relocated shadcn primitive; internal `Button` import becomes `./button` |
| `apps/web/components/ui/skeleton.tsx` → `packages/ui/src/base/skeleton.tsx` | Relocated shadcn primitive, unchanged |
| `apps/web/components/ui/tooltip.tsx` → `packages/ui/src/base/tooltip.tsx` | Relocated shadcn primitive, unchanged |
| `packages/ui/src/base/button.test.tsx` | New: variant/size class contract + prop-passthrough tests |
| `packages/ui/src/button.tsx` | **Deleted** — the old hardcoded `Button`, replaced by the relocated primitive |
| `packages/ui/src/modal.tsx` → `packages/ui/src/base/modal.tsx` | Existing composition, relocated; internal `use-dialog-behavior` import becomes `../internal/use-dialog-behavior` |
| `packages/ui/src/data-table.tsx` → `packages/ui/src/base/data-table.tsx` | Existing composition, relocated unchanged (its `Button`/`ErrorState`/`LoadingState` imports stay sibling-relative) |
| `packages/ui/src/form-field.tsx` → `packages/ui/src/base/form-field.tsx` | Existing composition, relocated unchanged |
| `packages/ui/src/status-badge.tsx` → `packages/ui/src/base/status-badge.tsx` | Existing composition, relocated unchanged |
| `packages/ui/src/page-header.tsx` → `packages/ui/src/base/page-header.tsx` | Existing composition, relocated unchanged |
| `packages/ui/src/loading-state.tsx` → `packages/ui/src/base/loading-state.tsx` | Existing composition, relocated unchanged |
| `packages/ui/src/empty-state.tsx` → `packages/ui/src/base/empty-state.tsx` | Existing composition, relocated unchanged |
| `packages/ui/src/error-state.tsx` → `packages/ui/src/base/error-state.tsx` | Existing composition, relocated unchanged (its `Button` import stays `./button`) |
| `packages/ui/src/detail-drawer.tsx` → `packages/ui/src/base/detail-drawer.tsx` | Existing composition, relocated; internal `use-dialog-behavior` import becomes `../internal/use-dialog-behavior` |
| `packages/ui/src/toast.tsx` → `packages/ui/src/base/toast.tsx` | Existing composition, relocated unchanged |
| `packages/ui/src/form-dialog.tsx` → `packages/ui/src/base/dialogs/form-dialog.tsx` | Existing composition, relocated; `./modal`/`./button` imports become `../modal`/`../button` |
| `packages/ui/src/confirm-dialog.tsx` → `packages/ui/src/base/dialogs/confirm-dialog.tsx` | Existing composition, relocated; `./modal`/`./button` imports become `../modal`/`../button`; `variant="danger"` → `variant="destructive"` |
| `packages/ui/src/internal/use-dialog-behavior.ts` | Unchanged, stays at `src/internal/` |
| `packages/ui/src/domain/README.md` | New: scaffold note for future domain-specific composition (empty otherwise) |
| `packages/ui/README.md` | New: boundary rule doc (§4.1) |
| `packages/ui/src/index.ts` | Rewritten: exports every relocated primitive's full named-export set + every existing composition, from their new `base/` (and `base/dialogs/`) paths |
| `apps/web/components/layout/dashboard-layout.tsx` | `Button` import → `from '@clensy/ui'` |
| `apps/web/components/layout/app-sidebar.tsx` | `Button`/`Separator`/`Sheet*`/`Tooltip*` imports → `from '@clensy/ui'` |
| `apps/web/components/layout/user-menu.tsx` | `Avatar`/`AvatarFallback`/`Button`/`DropdownMenu*`/`Skeleton` imports → `from '@clensy/ui'` |
| `apps/web/components/ui/` | **Deleted** (directory removed once the three files above no longer reference it) |
| `apps/web/components.json` | **Deleted** (shadcn CLI anchor; see Task 3 for the documented replacement workflow) |
| `apps/web/package.json` | Drops `radix-ui`, `class-variance-authority`; keeps `cn`, `lucide-react` |
| `apps/web/app/app/admin/page.tsx` | `variant="danger"` (line 161) → `variant="destructive"` |
| `apps/web/app/app/bookings/page.tsx` | `variant="danger"` (line 536) → `variant="destructive"` |
| `apps/web/README.md` | Short addition: `apps/web` must not import shadcn/Radix directly or hold `components.json` |
| `README.md` (root) | `packages/ui:` line reworded to describe the shared UI system without naming `radix-ui`/`class-variance-authority`; `apps/web:` line drops `components/ui/*` |

**Must remain untouched:** `apps/api/**`, `apps/web/app/globals.css`, `apps/web/middleware.ts`, `apps/web/next.config.ts`, `packages/validation/**`, `packages/client/**`, every `apps/web` page file other than the two named `danger` renames, `Modal`/`FormDialog`/`ConfirmDialog`/`DetailDrawer`'s own markup and behavior (location and the one variant rename only), every relocated primitive's variants/sizes/props.

---

### Task 1: `packages/ui` dependencies and test scaffolding

**Files:**
- Modify: `packages/ui/package.json`
- Create: `packages/ui/vitest.config.ts`, `packages/ui/src/index.test.ts`

**Interfaces:** none yet — this task changes zero runtime behavior, only adds dependencies and a test runner to the package unchanged otherwise.

- [ ] **Step 1: Re-verify the four dependency versions before writing them down**

```bash
grep -n '"radix-ui"\|"class-variance-authority"\|"cn"\|"lucide-react"\|"react-dom"\|"@types/react-dom"' apps/web/package.json
```

Use exactly what this prints, not the versions cited in the spec/this plan, in case any has drifted since 2026-09-16.

- [ ] **Step 2: Edit `packages/ui/package.json`** — add a `dependencies` block (new — the package has none today) and a `test` script + `vitest` devDependency:

```json
{
  "name": "@clensy/ui",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.ts",
  "scripts": {
    "build": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run"
  },
  "peerDependencies": {
    "react": "^19.2.8"
  },
  "dependencies": {
    "class-variance-authority": "^0.7.1",
    "cn": "^0.2.6",
    "lucide-react": "^1.43.0",
    "radix-ui": "^1.6.7"
  },
  "devDependencies": {
    "@eslint/js": "^9.18.0",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.4",
    "eslint": "^9.18.0",
    "globals": "^17.0.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.20.0",
    "vitest": "^5.0.0"
  }
}
```

`vitest`'s version should match `apps/web/package.json`'s installed major for consistency (`^5.0.0` at spec time — confirm with `grep '"vitest"' apps/web/package.json`). `react-dom`/`@types/react-dom` are new here — `packages/ui`'s runtime code never imports `react-dom` (only `react`, which stays the sole `peerDependency`); they're needed only by Task 2's `button.test.tsx`, which calls `react-dom/server`'s `renderToStaticMarkup` to verify prop passthrough without a DOM. Devependency-only is correct; do not add `react-dom` as a `peerDependency` or `dependency`. Re-verify both versions against `apps/web/package.json` in Step 1 below, same as the other four.

- [ ] **Step 3: Write `packages/ui/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

`environment: 'node'` (not `jsdom`) matches the spec's "lightest mechanism" testing strategy (§7) — Task 2's `Button` test asserts against `buttonVariants`'s string output and `react-dom/server`-rendered markup, neither of which needs a DOM.

- [ ] **Step 4: Write the failing smoke test**

`packages/ui/src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import * as ui from './index';

describe('@clensy/ui package', () => {
  it('resolves as a module', () => {
    expect(ui).toBeDefined();
  });
});
```

This is **runner-wiring smoke coverage only** — it proves `vitest` resolves and runs against this package's `tsconfig`/module setup, not that the public API is correct. It passes immediately (the package's existing `index.ts` already exports real things) and mirrors `packages/validation`'s Task 1 precedent. Task 2's `button.test.tsx` is where real contract coverage starts; don't treat this step as API verification.

- [ ] **Step 5: Install and verify**

```bash
pnpm install
pnpm --filter @clensy/ui lint
pnpm --filter @clensy/ui build
pnpm --filter @clensy/ui test
```

Expect all three to pass — the package's actual source is untouched by this task.

- [ ] **Step 6 (no commit yet per instruction — leave working tree as-is for review).**

---

### Task 2: Relocate the seven shadcn primitives and every existing composition into `base/`

**Files:**
- Create: `packages/ui/src/base/avatar.tsx`, `packages/ui/src/base/button.tsx`, `packages/ui/src/base/dropdown-menu.tsx`, `packages/ui/src/base/separator.tsx`, `packages/ui/src/base/sheet.tsx`, `packages/ui/src/base/skeleton.tsx`, `packages/ui/src/base/tooltip.tsx`, `packages/ui/src/base/button.test.tsx`, `packages/ui/src/base/modal.tsx`, `packages/ui/src/base/data-table.tsx`, `packages/ui/src/base/form-field.tsx`, `packages/ui/src/base/status-badge.tsx`, `packages/ui/src/base/page-header.tsx`, `packages/ui/src/base/loading-state.tsx`, `packages/ui/src/base/empty-state.tsx`, `packages/ui/src/base/error-state.tsx`, `packages/ui/src/base/detail-drawer.tsx`, `packages/ui/src/base/toast.tsx`, `packages/ui/src/base/dialogs/form-dialog.tsx`, `packages/ui/src/base/dialogs/confirm-dialog.tsx`, `packages/ui/src/domain/README.md`
- Delete: `packages/ui/src/button.tsx`, `packages/ui/src/modal.tsx`, `packages/ui/src/data-table.tsx`, `packages/ui/src/form-field.tsx`, `packages/ui/src/status-badge.tsx`, `packages/ui/src/page-header.tsx`, `packages/ui/src/loading-state.tsx`, `packages/ui/src/empty-state.tsx`, `packages/ui/src/error-state.tsx`, `packages/ui/src/detail-drawer.tsx`, `packages/ui/src/toast.tsx`, `packages/ui/src/form-dialog.tsx`, `packages/ui/src/confirm-dialog.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Produces: every relocated primitive's full named-export set (see Step 8's `index.ts` for the exact list), and the existing composition exports unchanged in name/shape.

- [ ] **Step 1: Move the five primitives that need zero content change** (`button.tsx` and `sheet.tsx` are handled separately in Steps 2–3 — `button.tsx` because it becomes the collapsed `Button`, `sheet.tsx` because its one internal import needs fixing)

```bash
git mv apps/web/components/ui/avatar.tsx packages/ui/src/base/avatar.tsx
git mv apps/web/components/ui/dropdown-menu.tsx packages/ui/src/base/dropdown-menu.tsx
git mv apps/web/components/ui/separator.tsx packages/ui/src/base/separator.tsx
git mv apps/web/components/ui/skeleton.tsx packages/ui/src/base/skeleton.tsx
git mv apps/web/components/ui/tooltip.tsx packages/ui/src/base/tooltip.tsx
```

Confirm each file's content is byte-identical after the move (`git diff --cached` shows only a rename, no content hunk).

- [ ] **Step 2: Move `button.tsx`** (also unchanged content — it becomes the only `Button`):

```bash
git mv apps/web/components/ui/button.tsx packages/ui/src/base/button.tsx
```

- [ ] **Step 3: Move and fix `sheet.tsx`**

```bash
git mv apps/web/components/ui/sheet.tsx packages/ui/src/base/sheet.tsx
```

Edit its one import:

```diff
- import { Button } from "@/components/ui/button"
+ import { Button } from "./button"
```

- [ ] **Step 4: Delete the old hardcoded `Button`**

```bash
git rm packages/ui/src/button.tsx
```

- [ ] **Step 5: Write the `Button` test — derive the contract from the file you just moved, not from this plan**

Before writing any assertion, open `packages/ui/src/base/button.tsx` (the file Step 2 just placed there) and read its `cva` config directly. Do not copy variant/size names or token-class substrings from this plan document — this plan was written by reading the same file at spec/plan time, but the file is the source of truth at execution time, not this document. If it has drifted (an unrelated shadcn theme tweak, an extra variant added since), the test must reflect what's actually there.

The test verifies three things, structurally, for whatever the file actually declares:

1. **Every declared variant resolves to a distinct, non-empty class string**, and the variants that this migration's consumers actually depend on (`default`, `secondary`, `destructive` — the three named in spec §4.6) produce output containing that variant's characteristic token utility class, confirming they're token-based and not the old hardcoded `slate`/`red`. As read at plan-writing time, that's `bg-primary` (`default`), `bg-secondary` (`secondary`), `bg-destructive` (`destructive`) — **re-confirm each substring against the actual file before asserting it**, since this is exactly the kind of implementation string that can legitimately drift without affecting this migration's correctness.
2. **Every declared size resolves to a distinct, non-empty class string** — enumerate whatever size keys the file's `variants.size` object actually has (read them off the file; as read at plan-writing time there were 8: `default`, `icon`, `icon-lg`, `icon-sm`, `icon-xs`, `lg`, `sm`, `xs` — re-confirm the list, don't assume it's still 8 or still these names).
3. **Omitted `variant`/`size` equal the file's own `defaultVariants`** (read `defaultVariants` off the file rather than assuming `'default'`/`'default'`, even though that's what it says today), and **`className`/`type`/`aria-*` pass through** via `react-dom/server`'s `renderToStaticMarkup` (no DOM needed).

Shape (fill in the variant/size names and token substrings from the actual file, per the instructions above — this is scaffolding, not the literal test):

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button, buttonVariants } from './button';

// Read off packages/ui/src/base/button.tsx's cva config — do not assume these
// match the plan document; re-derive them here.
const VARIANTS = [/* every variants.variant key, from the file */] as const;
const SIZES = [/* every variants.size key, from the file */] as const;

describe('Button (relocated shadcn primitive)', () => {
  it('resolves every declared variant to a distinct class string', () => {
    const outputs = VARIANTS.map((variant) => buttonVariants({ variant }));
    expect(new Set(outputs).size).toBe(VARIANTS.length);
  });

  it('resolves every declared size to a distinct class string', () => {
    const outputs = SIZES.map((size) => buttonVariants({ size }));
    expect(new Set(outputs).size).toBe(SIZES.length);
  });

  it('produces token-based classes for the variants existing consumers use', () => {
    // Substrings re-confirmed against base/button.tsx immediately before writing this,
    // not copied from the plan.
    expect(buttonVariants({ variant: 'default' })).toContain('bg-primary');
    expect(buttonVariants({ variant: 'secondary' })).toContain('bg-secondary');
    expect(buttonVariants({ variant: 'destructive' })).toContain('bg-destructive');
  });

  it('defaults to the file\'s own defaultVariants when variant/size are omitted', () => {
    expect(buttonVariants({})).toBe(
      buttonVariants({ variant: /* defaultVariants.variant from the file */, size: /* defaultVariants.size from the file */ }),
    );
  });

  it('passes through className, type, and arbitrary DOM props', () => {
    const html = renderToStaticMarkup(
      <Button type="submit" className="custom-class" aria-label="Save">
        Save
      </Button>,
    );
    expect(html).toContain('type="submit"');
    expect(html).toContain('custom-class');
    expect(html).toContain('aria-label="Save"');
  });
});
```

Run it:

```bash
pnpm --filter @clensy/ui test -- button
```

Expect a pass — this is a characterization of the file that's already in place from Steps 2–3, not new behavior being implemented, so red-then-green here means "the test has a typo," not "the primitive is unfinished."

- [ ] **Step 6: Move the ten existing compositions that stay flat in `base/`**

```bash
git mv packages/ui/src/data-table.tsx packages/ui/src/base/data-table.tsx
git mv packages/ui/src/form-field.tsx packages/ui/src/base/form-field.tsx
git mv packages/ui/src/status-badge.tsx packages/ui/src/base/status-badge.tsx
git mv packages/ui/src/page-header.tsx packages/ui/src/base/page-header.tsx
git mv packages/ui/src/loading-state.tsx packages/ui/src/base/loading-state.tsx
git mv packages/ui/src/empty-state.tsx packages/ui/src/base/empty-state.tsx
git mv packages/ui/src/error-state.tsx packages/ui/src/base/error-state.tsx
git mv packages/ui/src/toast.tsx packages/ui/src/base/toast.tsx
```

None of these need an import fix: `data-table.tsx`'s `./button`/`./error-state`/`./loading-state` and `error-state.tsx`'s `./button` all stay valid — every file they reference moved into `base/` alongside them.

- [ ] **Step 7: Move and fix `modal.tsx` / `detail-drawer.tsx`** (both reference `internal/`, which stays at `src/internal/`, one level further up from `base/` than it was from `src/`):

```bash
git mv packages/ui/src/modal.tsx packages/ui/src/base/modal.tsx
git mv packages/ui/src/detail-drawer.tsx packages/ui/src/base/detail-drawer.tsx
```

Edit both files' one import:

```diff
- import { useDialogBehavior } from './internal/use-dialog-behavior';
+ import { useDialogBehavior } from '../internal/use-dialog-behavior';
```

- [ ] **Step 8: Move and fix `form-dialog.tsx` / `confirm-dialog.tsx` into `base/dialogs/`**

```bash
mkdir -p packages/ui/src/base/dialogs
git mv packages/ui/src/form-dialog.tsx packages/ui/src/base/dialogs/form-dialog.tsx
git mv packages/ui/src/confirm-dialog.tsx packages/ui/src/base/dialogs/confirm-dialog.tsx
```

Edit both files' `Modal`/`Button` imports (one level further from `base/`'s siblings now that they're in `base/dialogs/`):

```diff
- import { Modal } from './modal';
- import { Button } from './button';
+ import { Modal } from '../modal';
+ import { Button } from '../button';
```

In `confirm-dialog.tsx` only, also rename the confirm button's variant (spec §4.4, §4.6):

```diff
        <Button
          type="button"
-         variant="danger"
+         variant="destructive"
          onClick={() => void handleConfirmClick()}
          disabled={confirming}
        >
```

`form-dialog.tsx`'s existing `variant="primary"` submit button needs no change — `primary` isn't a valid variant on the new `Button` anymore, but `form-dialog.tsx` should read the diff and simply omit the prop (defaulting to `"default"`), since the two are equivalent:

```diff
-         <Button type="submit" variant="primary" disabled={submitting}>
+         <Button type="submit" disabled={submitting}>
```

- [ ] **Step 9: Scaffold `domain/`**

`packages/ui/src/domain/README.md`:

```markdown
# `domain/`

Reserved for business-domain-specific composition (e.g. a hypothetical
`domain/customers/CustomerDataTable`) — components that know about a specific
Clensy business domain, as opposed to `base/`'s domain-agnostic primitives and
generic composition.

Empty as of this package's `base/` migration (2026-09-16) — no second consumer
has needed a domain-specific extraction yet. Populate this directory only when
one genuinely does; do not seed it speculatively (see the design spec's
rationale, §5).

`domain/` components may depend on `base/` (primitives and generic
composition). They must not be depended on by `base/`.
```

- [ ] **Step 10: Rewrite `packages/ui/src/index.ts`**

```ts
export { Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarBadge } from './base/avatar';
export { Button, buttonVariants } from './base/button';
export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from './base/dropdown-menu';
export { Separator } from './base/separator';
export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from './base/sheet';
export { Skeleton } from './base/skeleton';
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './base/tooltip';

export { FormField } from './base/form-field';
export type { FormFieldProps } from './base/form-field';

export { DataTable } from './base/data-table';
export type { DataTableColumn, DataTableProps, DataTablePaginationProps } from './base/data-table';

export { StatusBadge } from './base/status-badge';
export type { StatusBadgeProps, StatusTone } from './base/status-badge';

export { Modal } from './base/modal';
export type { ModalProps } from './base/modal';

export { FormDialog } from './base/dialogs/form-dialog';
export type { FormDialogProps } from './base/dialogs/form-dialog';

export { ConfirmDialog } from './base/dialogs/confirm-dialog';
export type { ConfirmDialogProps } from './base/dialogs/confirm-dialog';

export { DetailDrawer } from './base/detail-drawer';
export type { DetailDrawerProps } from './base/detail-drawer';

export { PageHeader } from './base/page-header';
export type { PageHeaderProps } from './base/page-header';

export { ToastProvider, useToast } from './base/toast';
export type { ToastProviderProps, ToastContextValue, ToastTone } from './base/toast';

export { LoadingState } from './base/loading-state';
export type { LoadingStateProps } from './base/loading-state';

export { EmptyState } from './base/empty-state';
export type { EmptyStateProps } from './base/empty-state';

export { ErrorState } from './base/error-state';
export type { ErrorStateProps } from './base/error-state';
```

Note what's deliberately **not** re-exported here: `ButtonProps`/`ButtonVariant` (the old hardcoded `Button`'s types) don't exist anymore — nothing in `apps/web` should import them (Task 3, Step 1 greps to confirm before relying on this).

- [ ] **Step 11: Verify**

```bash
pnpm --filter @clensy/ui lint
pnpm --filter @clensy/ui build
pnpm --filter @clensy/ui test
```

Expect all three to pass, with `base/button.test.tsx`'s new assertions running (not just Task 1's smoke test).

Do **not** run `pnpm --filter web build` in this task, and do not attempt to fix `apps/web` here. It is expected to fail — its three app-shell files still import the now-deleted `apps/web/components/ui/*` — and that failure is Task 3's job to resolve, not a bug to diagnose now. `packages/ui`'s own lint/build/test passing (this step) is this task's complete exit criterion.

- [ ] **Step 12 (no commit yet — leave working tree as-is for review).**

---

### Task 3: Migrate `apps/web` consumers and remove the old primitive location

**Files:**
- Modify: `apps/web/components/layout/dashboard-layout.tsx`, `apps/web/components/layout/app-sidebar.tsx`, `apps/web/components/layout/user-menu.tsx`, `apps/web/package.json`, `apps/web/app/app/admin/page.tsx`, `apps/web/app/app/bookings/page.tsx`
- Delete: `apps/web/components/ui/` (should already be empty after Task 2's moves — confirm), `apps/web/components.json`

**Interfaces:** none new — every change here is a consumer-side import-path swap or a package.json edit.

- [ ] **Step 1: Confirm the blast radius before editing** (re-run, don't trust the spec's cached numbers):

```bash
grep -rln "from ['\"]@/components/ui/\|from ['\"]\.\./ui/\|from ['\"]\./ui/" apps/web --include="*.tsx"
grep -rn 'variant="danger"' apps packages --include="*.tsx"
grep -rn 'variant="primary"' apps --include="*.tsx"
grep -rn 'ButtonProps\|ButtonVariant' apps/web --include="*.tsx" --include="*.ts"
ls apps/web/components/ui/ 2>&1   # expect "No such file or directory" after Task 2's moves
```

Expect exactly `dashboard-layout.tsx`, `app-sidebar.tsx`, `user-menu.tsx` from the first command; exactly the two page-file occurrences from the second (the `confirm-dialog.tsx` occurrence was already fixed in Task 2); nothing from the third — if it prints a hit, stop and resolve it (either the consumer needs `React.ComponentProps<typeof Button>` instead, or the type genuinely needs re-adding to `index.ts`, which would mean returning to M2/M3, not inventing it here) before continuing.

- [ ] **Step 2: `dashboard-layout.tsx`**

```diff
- import { Button } from '../ui/button';
+ import { Button, ToastProvider } from '@clensy/ui';
```

(`ToastProvider` is already imported from `'@clensy/ui'` in this file — merge into the existing import statement rather than adding a second one.)

- [ ] **Step 3: `app-sidebar.tsx`**

```diff
- import { Button } from '../ui/button';
- import { Separator } from '../ui/separator';
- import { Sheet, SheetContent, SheetTitle } from '../ui/sheet';
- import {
-   Tooltip,
-   TooltipContent,
-   TooltipProvider,
-   TooltipTrigger,
- } from '../ui/tooltip';
+ import {
+   Button,
+   Separator,
+   Sheet,
+   SheetContent,
+   SheetTitle,
+   Tooltip,
+   TooltipContent,
+   TooltipProvider,
+   TooltipTrigger,
+ } from '@clensy/ui';
```

- [ ] **Step 4: `user-menu.tsx`**

```diff
- import { Avatar, AvatarFallback } from '../ui/avatar';
- import { Button } from '../ui/button';
- import {
-   DropdownMenu,
-   DropdownMenuContent,
-   DropdownMenuItem,
-   DropdownMenuLabel,
-   DropdownMenuSeparator,
-   DropdownMenuTrigger,
- } from '../ui/dropdown-menu';
- import { Skeleton } from '../ui/skeleton';
+ import {
+   Avatar,
+   AvatarFallback,
+   Button,
+   DropdownMenu,
+   DropdownMenuContent,
+   DropdownMenuItem,
+   DropdownMenuLabel,
+   DropdownMenuSeparator,
+   DropdownMenuTrigger,
+   Skeleton,
+ } from '@clensy/ui';
```

- [ ] **Step 5: Confirm `apps/web/components/ui/` is empty, then delete it**

```bash
ls apps/web/components/ui/ 2>&1
rmdir apps/web/components/ui
```

If `ls` shows any remaining file, stop — a consumer or a primitive was missed in Task 2/Step 1–4, find and fix it before deleting.

- [ ] **Step 6: Rename the two page-level `danger` usages**

`apps/web/app/app/admin/page.tsx:161` and `apps/web/app/app/bookings/page.tsx:536`:

```diff
-           variant="danger"
+           variant="destructive"
```

- [ ] **Step 7: Edit `apps/web/package.json`** — remove `radix-ui` and `class-variance-authority` from `dependencies`; leave `cn` and `lucide-react` in place.

- [ ] **Step 8: Remove the shadcn CLI anchor**

```bash
git rm apps/web/components.json
```

Add a short note to `packages/ui/README.md` (Task 4) that future shadcn component generation should target `packages/ui/src/base/` — e.g. by placing a `components.json` inside `packages/ui` when a primitive actually needs to be added, rather than leaving a stale one that no longer matches reality. Do not fabricate an untested `components.json` for `packages/ui` in this task; no new primitive is being generated by this plan, only relocated, so there's nothing to prove the CLI configuration against yet.

- [ ] **Step 9: Install and verify**

```bash
pnpm install
pnpm --filter web lint
pnpm --filter web build
```

Expect both to pass now that every consumer resolves against `@clensy/ui`.

- [ ] **Step 10 (no commit yet — leave working tree as-is for review).**

---

### Task 4: Documentation

**Files:**
- Create: `packages/ui/README.md`
- Modify: `apps/web/README.md`, `README.md` (root)

**Interfaces:** none (documentation only)

- [ ] **Step 1: Write `packages/ui/README.md`**, covering:
  - What `@clensy/ui` is: the shared UI system for `apps/web` (and any future consumer) — shadcn/`radix-ui`/`class-variance-authority` are its internal implementation, not its contract.
  - The boundary rule (spec §4.1's bullet list): generic primitives + generic composition live in `base/`; business-domain-specific composition lives in `domain/`; `internal/` is not part of the public surface; `@clensy/ui` must not import from `apps/web` (or any application); must not contain routing, business logic, or application-level data fetching (cross-reference `apps/web/README.md`'s existing `next-intl` rule as the precedent for this restriction).
  - Theme tokens: `@clensy/ui` consumes the application's semantic Tailwind tokens by class name; it does not own or inject the token CSS (spec §4.7) — point at `apps/web/app/globals.css` as today's sole source.
  - The `domain/README.md` scaffold note's substance, summarized (point there for the full text rather than duplicating it).
  - The shadcn CLI note from Task 3/Step 8: future primitive generation targets `packages/ui/src/base/`, not `apps/web`; the exact CLI workflow is established when the next primitive is actually added, not speculatively here.

- [ ] **Step 2: Add to `apps/web/README.md`**, near its existing UI-related bullets (the `@clensy/ui` primitives mention, the i18n `@clensy/ui` rule) — a short addition stating the `apps/web`-side half of the same rule: `apps/web` MUST NOT contain shadcn-generated components, MUST NOT import shadcn/`radix-ui` directly, MUST NOT depend on shadcn-specific configuration (no `components.json`); it consumes UI only through `@clensy/ui`'s public API. Note that general-purpose libraries a shadcn primitive also happens to use (`cn`, `lucide-react`) remain ordinary `apps/web` dependencies for its own non-primitive needs — this isn't a shadcn dependency.

- [ ] **Step 3: Update the root `README.md` monorepo-layout tree** — reword the `packages/ui:` line to describe it as the shared UI system (primitives and composition together) without naming `radix-ui`/`class-variance-authority` (keep that detail inside `packages/ui/README.md`, not the root tree — spec §4.1's own rule that `apps/web` doesn't need shadcn knowledge extends to not advertising it at the monorepo-documentation level either); drop `components/ui/*` from the `apps/web:` line's description.

- [ ] **Step 4 (no commit yet — leave working tree as-is for review).**

---

### Task 5: Full verification

**Files:** none new unless a compatibility fix surfaces (then the smallest change to the affected file, called out explicitly rather than folded silently into this task).

- [ ] **Step 1: Grep-verifiable acceptance gates (spec §7)**

```bash
grep -rn 'variant="danger"\|variant='"'"'danger'"'"'' apps packages --include="*.tsx"
grep -rn 'variant="primary"\|variant='"'"'primary'"'"'' apps packages --include="*.tsx"
grep -rln "apps/web/components/ui\|from ['\"]@/components/ui/\|from ['\"]\.\./ui/\|from ['\"]\./ui/" apps/web --include="*.tsx" --include="*.ts"
ls apps/web/components/ui 2>&1
ls apps/web/components.json 2>&1
```

Expect the first four to print nothing, and the last two to print "No such file or directory".

- [ ] **Step 2: Full monorepo checks**

```bash
pnpm --filter @clensy/ui lint
pnpm --filter @clensy/ui build
pnpm --filter @clensy/ui test
pnpm --filter web lint
pnpm --filter web build
```

- [ ] **Step 3: Clean-tree scope check**

This plan makes no commits (per instruction) — every change so far is uncommitted, split across the working tree and the index (`git mv`/`git rm` stage their changes; edited files after a move may be unstaged). `git diff main...HEAD` would compare committed history only and show nothing either way, which proves nothing here. Check both the working tree and the index directly:

```bash
git status --short
git diff --stat -- apps/api packages/validation packages/client apps/web/app/globals.css apps/web/middleware.ts apps/web/next.config.ts
git diff --cached --stat -- apps/api packages/validation packages/client apps/web/app/globals.css apps/web/middleware.ts apps/web/next.config.ts
```

Expect both `diff` commands' output to be empty — none of these paths are touched by this plan, staged or unstaged.

- [ ] **Step 4: Manual golden path** (spec §7) — start the dev server and confirm, without a Playwright/RTL suite (none exists in this repo):
  1. Module screens: `/login`, `/app/customers` (create/edit dialogs, `secondary` cancel buttons), `/app/bookings`, `/app/catalog`, `/app/catalog/add-ons`, `/app/cleaners`, `/app/cleaners/teams`, `/app/jobs`, `/app/laundry`, `/app/admin` — the renamed `destructive` actions in `admin`/`bookings` render and behave as the old `danger` variant did; everything else renders identically.
  2. App shell: mobile-nav toggle (`dashboard-layout.tsx`), sidebar collapse/expand button, collapsed-sidebar tooltips, mobile `Sheet` drawer open/close (`app-sidebar.tsx`), user menu dropdown (avatar, theme options with the check-mark indicator, sign-out `destructive` item, loading `Skeleton`) (`user-menu.tsx`).

- [ ] **Step 5: N/A unless Step 1–4 surfaced a fix — if so, note what broke and why, as its own reviewable change.**

---

## Spec coverage

| Spec | Task |
| --- | --- |
| The rule; `apps/web` MUST/MUST NOT list; `packages/ui/README.md` boundary doc; root/`apps/web` README updates (§4.1) | 4 |
| Full seven-primitive + composition inventory and disposition (§4.2) | 2 |
| Package layout (`base/`, `base/dialogs/`, `domain/` scaffold, `internal/` unchanged); dependency provenance (§4.3) | 1, 2, 3 |
| `Button` collapse to one component, shadcn vocabulary, grep-verified `danger`→`destructive`/`primary`-is-a-no-op (§4.4) | 2 |
| App-shell consumer migration, verified consumer enumeration (§4.5) | 3 |
| Full `danger`→`destructive` rename inventory, `form-dialog.tsx`'s internal `primary` no-op (§4.6) | 2, 3 |
| Theme-token ownership split — not relocated, consumed by class name only (§4.7) | (no code change — verified by omission in Task 5/Step 3) |
| Followed-by items explicitly deferred, not implemented (§6) | (verified by omission — Task 5/Step 1's grep gates would catch accidental scope creep) |
| Testing/acceptance: `vitest` wiring, `Button` variant/size/passthrough coverage, grep gates, build gates, manual golden path (§7) | 1, 2, 5 |
| Non-goals: no `Dialog` primitive, no `Modal`/`FormDialog`/`ConfirmDialog`/`DetailDrawer` migration, no `domain/` component, no lint rule, no `jsdom`, no restyle, no new variants (§8) | 5 (verified by omission) |

## Type consistency

- `Button`/`buttonVariants` — Task 2, the only `Button`-shaped export from `@clensy/ui`; consumed by `DataTable`/`ErrorState`/`FormDialog`/`ConfirmDialog` (Task 2, sibling-relative imports) and by the three app-shell files (Task 3)
- `FormFieldProps`, `DataTableColumn`/`DataTableProps`/`DataTablePaginationProps`, `StatusBadgeProps`/`StatusTone`, `ModalProps`, `FormDialogProps`, `ConfirmDialogProps`, `DetailDrawerProps`, `PageHeaderProps`, `ToastProviderProps`/`ToastContextValue`/`ToastTone`, `LoadingStateProps`, `EmptyStateProps`, `ErrorStateProps` — Task 2, unchanged shapes, re-exported from their new `base/` paths in `index.ts`
- `ButtonProps`/`ButtonVariant` (old hardcoded `Button`'s types) — **removed**, Task 2; Task 3/Step 1 greps `apps/web` to confirm nothing imports them before Task 3 proceeds
