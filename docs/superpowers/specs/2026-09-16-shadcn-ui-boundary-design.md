# `@clensy/ui` as the Shared UI System — Design

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-09-16 |
| Tracking issue | [#57](https://github.com/rexescario-dev/clensy-platform/issues/57) — "Establish shadcn/ui as the primitive layer; keep `@clensy/ui` composition-only" |
| Depends on (Accepted) | [Phase 1 Design](2026-08-14-clensy-platform-phase1-design.md) §2.5 — `packages/ui` as the API/domain-agnostic component home. [Web Shell & Design System](2026-09-10-web-shell-and-design-system-design.md) — introduced `apps/web/components/ui/*` (shadcn primitives, Tailwind 4, semantic tokens) as *shell-only, time-boxed* tooling and explicitly deferred "`@clensy/ui` → shadcn migration" as a later slice, naming the exact reason: *"Putting shadcn in the shared package in this slice would mix two visual languages in one kit and invite accidental module adoption. A later unify-the-design-system spec can move primitives if needed."* This spec is that later slice. |
| Related (not a dependency) | [`@clensy/validation` Design](2026-09-15-clensy-validation-design.md) — established the `packages/*/README.md` "**Boundary this package enforces:**" documentation convention this spec follows for `packages/ui/README.md` (new file). |
| Followed by | A future slice may add a shadcn `Dialog` primitive and reconcile `Modal`/`FormDialog`/`ConfirmDialog` onto it, and migrate `DetailDrawer` onto the now-relocated `Sheet` primitive (§6). A future slice also populates `packages/ui/src/domain/` with the first domain-specific composition once a second consumer needs one (§6) — none is added by this spec. |
| Governing references | This document. It does not redesign the Web Shell & Design System spec's visual tokens, `ShellChrome`/`BrandMark`, or shell layout behavior — it relocates that spec's primitive layer into `packages/ui` and updates the three app-shell files that consumed it directly. |
| M3 decision | **Accepted** — 2026-09-16. Two review rounds: round 1 required resolving the physical `packages/ui` → `apps/web` dependency-direction conflict (relocation, not a wrapper or a leave-in-place compose) and widened scope to all seven existing primitives plus the app shell in one slice; round 2 tightened wording (theme-token ownership split into its own §4.7, `components.json` split into normative-outcome vs. implementation-mechanism, dependency provenance stated as read directly off the relocated files rather than assumed, root README kept implementation-detail-free, "verbatim" defined precisely in §3). No remaining design blocker. Ready for M4 Implementation Planning. |

## 1. Thesis

**`@clensy/ui` is the architecture; shadcn is an implementation detail of it.** Today `apps/web` has two overlapping, independently-owned UI sources: `@clensy/ui`'s hardcoded-color `Button`, and seven shadcn-generated primitives (`avatar`, `button`, `dropdown-menu`, `separator`, `sheet`, `skeleton`, `tooltip`) under `apps/web/components/ui/`, the latter placed there by the Web Shell & Design System slice as a **deliberate, time-boxed** choice pending exactly this follow-up (see "Depends on" above). This spec makes `@clensy/ui` the single, durable owner of the shared UI system: all seven existing shadcn primitives relocate into `packages/ui/src/base/`, alongside `@clensy/ui`'s existing generic compositions (also organized under `base/`); `apps/web/components/ui/*` and its shadcn CLI anchor (`components.json`) are removed; every consumer — the pre-existing `@clensy/ui` consumers and the three app-shell files that bypassed it — now imports only from `@clensy/ui`, with no visibility into whether a given export is shadcn-backed or hand-composed. A new, empty `packages/ui/src/domain/` is scaffolded for future business-domain-specific composition.

## 2. Scope

**In scope (normative):**

- A documented architecture rule (§4.1): `apps/web` consumes UI **only** through `@clensy/ui`'s public API and has no shadcn/Radix-specific knowledge of its own; `@clensy/ui` owns, and may internally use, shadcn/`radix-ui`/`class-variance-authority`; primitives live in `packages/ui/src/base/`, generic compositions alongside them in `base/`, business-domain-specific composition in `domain/`.
- Relocating all seven existing shadcn primitives (`avatar.tsx`, `button.tsx`, `dropdown-menu.tsx`, `separator.tsx`, `sheet.tsx`, `skeleton.tsx`, `tooltip.tsx`) verbatim from `apps/web/components/ui/` into `packages/ui/src/base/`, giving `packages/ui` its own `radix-ui`, `class-variance-authority`, `cn`, and `lucide-react` dependencies (§4.3).
- Reorganizing `packages/ui`'s existing compositions into `src/base/` (flat, alongside the relocated primitives) with a `base/dialogs/` subfolder for `form-dialog.tsx`/`confirm-dialog.tsx`; scaffolding an empty `src/domain/` directory; leaving `src/internal/` as-is (§4.3).
- Collapsing `@clensy/ui`'s hardcoded `Button` and the relocated shadcn `Button` into one component using shadcn's variant vocabulary (`default`/`secondary`/`destructive`/`outline`/`ghost`/`link`) in place of `@clensy/ui`'s current closed `danger`/`primary`/`secondary` set — a small, fully enumerated, required rename, not a preserved-API wrapper (§4.4).
- Updating `apps/web`'s three app-shell files (`dashboard-layout.tsx`, `app-sidebar.tsx`, `user-menu.tsx` — today's pre-existing direct-shadcn-import boundary violation) to import every primitive they use from `@clensy/ui` (§4.5).
- Removing `radix-ui` and `class-variance-authority` from `apps/web/package.json` (verified zero remaining consumers after relocation — §4.3); `apps/web` keeps `cn` and `lucide-react` for its own non-primitive usage, which is not a boundary violation (§4.3).
- Deleting `apps/web/components/ui/*` and repointing (or removing) the shadcn CLI anchor (`apps/web/components.json`) once every consumer is migrated (§4.3).
- `@clensy/ui`'s public surface (`index.ts`) exporting every relocated primitive's full named-export set alongside its existing composition exports (§4.3).
- A `packages/ui/README.md` (new file) stating the primitive/base/domain boundary rule and the theme-token ownership split (§4.1, §4.6); short cross-reference updates to `apps/web/README.md` and the root `README.md` monorepo-layout tree.
- New unit-level test coverage in `packages/ui` for `Button`'s variant/size contract (new `vitest` wiring for the package — none exists today), a grep-verifiable acceptance gate that no `primary`/`danger` `Button` variant or `apps/web/components/ui` import remains anywhere in the repository, plus a manual smoke pass of both the existing `@clensy/ui`-consuming module screens and the app shell (§7).

**Informative:** the full inventory in §4.2, including every `@clensy/ui` composition this spec leaves untouched.

**Out of scope:**

- Adding a shadcn `Dialog` primitive, or migrating `Modal`/`FormDialog`/`ConfirmDialog` onto one. No shadcn `Dialog` exists anywhere in this repository today; authoring one from scratch is materially different work from relocating seven already-generated, already-in-production files. Recorded as a followed-by item (§6).
- Migrating `DetailDrawer` onto the now-relocated `Sheet` primitive, even though `Sheet` will physically exist in `packages/ui` after this slice — a distinct behavioral reconciliation, not a location move. Recorded as a followed-by item (§6).
- Populating `packages/ui/src/domain/` with any actual component. It is scaffolded (directory + a short README note) and left empty (§4.3, §5).
- Relocating the theme CSS variables themselves (`apps/web/app/globals.css`). The application remains responsible for injecting them; `@clensy/ui` consumes them (§4.6).
- Adding a `no-restricted-imports` (or equivalent) lint rule enforcing the `@clensy/ui`-only boundary at the `apps/web` app-code level. Worth doing, not required by this migration (§6).
- Introducing `jsdom`/`@testing-library/react` component-rendering test infrastructure. No package in this repository has it today (§7).
- Visual/UX redesign of any migrated screen. The acceptance bar is "renders the same, sourced from one system instead of two" (plus the enumerated `danger`→`destructive` rename), not a restyle.

## 3. Terminology

- **shadcn primitive:** a content-agnostic, generated `radix-ui`/`class-variance-authority`-based UI building block (`Avatar`, `Button`, `DropdownMenu`, `Separator`, `Sheet`, `Skeleton`, `Tooltip`). Must not import Clensy domain types, `@clensy/client`, `next-intl`, or translated copy. An **implementation detail of `@clensy/ui`** — not something `apps/web` has its own opinion about (§4.1).
- **`base/` layer:** `packages/ui/src/base/` — the single directory holding both the relocated shadcn primitives and `@clensy/ui`'s existing generic (domain-agnostic) compositions. Not split into a separate "primitives" folder (§5).
- **`domain/` layer:** `packages/ui/src/domain/` — reserved for future business-domain-specific composition. Scaffolded, empty, in this spec.
- **`internal/` layer:** `packages/ui/src/internal/` — implementation details not part of the public export surface. Unchanged by this spec.
- **"Verbatim" / behaviorally-unchanged relocation:** used throughout §4.2–§4.5 for a moved file. Means the component's markup, props, and rendered behavior do not change — it does **not** mean the file is frozen byte-for-byte. Package-local import paths necessarily do change (e.g. `sheet.tsx`'s `@/components/ui/button` becomes a relative `./button` once both files live in `packages/ui/src/base/`), and dependency resolution moves from `apps/web/package.json` to `packages/ui/package.json` (§4.3). An implementer fixes an import that the move itself breaks; that is part of "verbatim," not a deviation from it.
- **Semantic theme tokens:** the CSS custom properties (`--primary`, `--destructive`, `--secondary`, …) an application injects globally (today, `apps/web/app/globals.css`). `@clensy/ui`'s primitives consume these by class name (`bg-primary`, `text-destructive`, …); `@clensy/ui` does not own or duplicate them (§4.6).
- **Layering (dependency direction):** shadcn/Radix internals → `base/` (primitives + generic composition) → `domain/` → `apps/web` application code, consuming semantic theme tokens the application provides at the CSS layer, not the module layer. Never the reverse.

## 4. Architecture & behavioral contracts

### 4.1 The rule

> `@clensy/ui` is the shared UI system for `apps/web` (and any future consumer). shadcn, `radix-ui`, and `class-variance-authority` are `@clensy/ui`'s internal implementation foundation, not the architecture itself. `apps/web` knows only `@clensy/ui`'s public API.

Concretely:

- `apps/web` MUST NOT contain shadcn-generated components.
- `apps/web` MUST NOT import shadcn or `radix-ui` components directly.
- `apps/web` MUST NOT depend on shadcn-specific APIs or configuration (`components.json` is not an architectural fixture of `apps/web` — §4.3).
- `packages/ui` is the **only** owner of shadcn primitives; primitives live in `packages/ui/src/base/`.
- `packages/ui` may use shadcn/`radix-ui` internally, without exposing that choice as part of its own contract — a future replacement of the underlying primitive implementation stays inside `packages/ui`.
- `apps/web` — pages, features, and the app shell alike — consumes UI only through `@clensy/ui`'s public API.
- Neither `apps/web` application code nor `@clensy/ui` reimplements a primitive shadcn already provides; a missing primitive is added once, in `packages/ui/src/base/`, not copied or duplicated at the call site.

`apps/web` may still use general-purpose dependencies (`lucide-react` for its own icons, `cn` for its own `className` composition) independently — the restriction is on shadcn/Radix UI *components* and shadcn-specific *configuration*, not on every transitive or coincidentally shared utility. §4.3 has the exact, verified accounting of what `apps/web` keeps and drops.

This is the direct, one-slice-later fulfillment of the Web Shell & Design System spec's own deferred plan — that spec put shadcn in `apps/web` *because* `packages/ui` wasn't ready to receive it yet in that slice, not because `apps/web` was meant to be its permanent home.

Documented in `packages/ui/README.md` (new), following `packages/validation/README.md`'s "Boundary this package enforces" convention:

```text
Boundary this package enforces:

- Generic UI primitives (shadcn/radix-ui-based) live in src/base/.
- Generic Clensy UI composition lives in src/base/, alongside the primitives.
- Domain-specific composition belongs in src/domain/.
- This package must not import from apps/web (or any application).
- This package must not contain routing, business logic, or application-level
  data fetching (existing rule, unchanged — see apps/web/README.md's i18n
  boundary for the equivalent next-intl restriction).
- This package consumes the application's semantic theme tokens by class name;
  it does not own or inject the token CSS itself (§4.6).
```

A short addition to `apps/web/README.md`'s existing UI-related bullets states the `apps/web`-side half of the same rule (the MUST NOT list above). The root `README.md` monorepo-layout tree's `packages/ui:` line is reworded to describe it as the shared UI system (primitives and composition together) without naming its internal implementation — `radix-ui`/`class-variance-authority` stay an implementation detail of `packages/ui`, not root-level documentation, consistent with §4.1's rule that `apps/web` doesn't need to know shadcn exists: the monorepo tree shouldn't advertise it either. Its `apps/web:` line drops the now-removed `components/ui/*` primitives.

### 4.2 Inventory: every `@clensy/ui` / shadcn export and its disposition

| Component | Today | Disposition this slice |
| --- | --- | --- |
| `Button` | Duplicated: hardcoded `@clensy/ui` version + shadcn `apps/web/components/ui/button.tsx` | **Relocated to `base/button.tsx`, becomes the only `Button`.** Variant vocabulary changes (§4.4). |
| `Avatar` (+`AvatarImage`/`AvatarFallback`/`AvatarGroup`/`AvatarGroupCount`/`AvatarBadge`) | shadcn only, `apps/web/components/ui/avatar.tsx`; consumed by `user-menu.tsx` | **Relocated to `base/avatar.tsx` verbatim.** |
| `DropdownMenu` (+ 14 sub-exports) | shadcn only, `apps/web/components/ui/dropdown-menu.tsx`; consumed by `user-menu.tsx` | **Relocated to `base/dropdown-menu.tsx` verbatim.** |
| `Separator` | shadcn only, `apps/web/components/ui/separator.tsx`; consumed by `app-sidebar.tsx` | **Relocated to `base/separator.tsx` verbatim.** |
| `Sheet` (+ 7 sub-exports) | shadcn only, `apps/web/components/ui/sheet.tsx`; consumed by `app-sidebar.tsx` (mobile nav) | **Relocated to `base/sheet.tsx` verbatim** (its own internal `Button` import becomes a relative `./button` import within `base/`). |
| `Skeleton` | shadcn only, `apps/web/components/ui/skeleton.tsx`; consumed by `user-menu.tsx` | **Relocated to `base/skeleton.tsx` verbatim.** |
| `Tooltip` (+ 3 sub-exports) | shadcn only, `apps/web/components/ui/tooltip.tsx`; consumed by `app-sidebar.tsx` | **Relocated to `base/tooltip.tsx` verbatim.** |
| `Modal`, `FormDialog`, `ConfirmDialog` | `@clensy/ui` composition, hand-rolled dialog markup (`useDialogBehavior`). No shadcn `Dialog` exists anywhere in this repo. | **Moved to `base/` (`base/dialogs/form-dialog.tsx`, `base/dialogs/confirm-dialog.tsx`; `modal.tsx` stays alongside them in `base/`), unchanged in implementation** except `confirm-dialog.tsx`'s `variant="danger"` → `variant="destructive"` (§4.4). Confirmed shadcn-`Dialog` overlap; not resolved this slice (§2, §6). |
| `DetailDrawer` | `@clensy/ui` composition, hand-rolled slide-out panel (`useDialogBehavior`). | **Moved to `base/detail-drawer.tsx`, unchanged.** Confirmed `Sheet` overlap; not migrated onto it this slice (§2, §6). |
| `FormField` | `@clensy/ui` composition (labeled `<input>` + error text) | **Moved to `base/form-field.tsx`, unchanged.** Still borderline vs. a hypothetical shadcn `Input`; not reclassified — [`@clensy/validation`](2026-09-15-clensy-validation-design.md) §6 depends on its current `error?: string` shape. |
| `DataTable` | `@clensy/ui` composition, composes `Button`/`ErrorState`/`LoadingState` internally | **Moved to `base/data-table.tsx`.** Its internal `Button` import resolves to the relocated primitive automatically (relative import within `base/`). |
| `StatusBadge`, `PageHeader`, `LoadingState`, `EmptyState`, `ErrorState`, `ToastProvider`/`useToast` | `@clensy/ui` composition | **Moved to `base/`, unchanged.** `ErrorState` inherits the `Button` relocation the same way `DataTable` does. |

### 4.3 Package layout and dependencies

```text
packages/ui/
  package.json            ← gains runtime dependencies read directly off the relocated
                              files' own import statements (§4.2's source reads), not
                              assumed from apps/web's dependency list or shadcn's typical
                              stack: "radix-ui" and "cn" (all 7 files import both directly
                              — every file has `import { cn } from "cn"`; avatar/dropdown-menu/
                              separator/sheet/tooltip additionally import a radix-ui primitive),
                              "class-variance-authority" (button.tsx only — the only file using
                              `cva`), "lucide-react" (dropdown-menu.tsx and sheet.tsx only —
                              CheckIcon/ChevronRightIcon and XIcon respectively; the other five
                              files render no icons of their own). Versions match what
                              apps/web currently pins for these same packages (radix-ui@^1.6.7,
                              class-variance-authority@^0.7.1, cn@^0.2.6, lucide-react@^1.43.0)
                              since that's where the files are generated today; re-confirm at
                              M6 in case they've since moved.
  README.md                ← new: states the boundary rule (§4.1)
  src/
    index.ts                 ← public export surface: every base/ export, primitives and
                                 compositions alike. domain/ has nothing to export yet.
    base/
      avatar.tsx                ← relocated shadcn primitive (verbatim)
      button.tsx                 ← relocated shadcn primitive (verbatim; the only Button)
      dropdown-menu.tsx           ← relocated shadcn primitive (verbatim)
      separator.tsx                ← relocated shadcn primitive (verbatim)
      sheet.tsx                     ← relocated shadcn primitive (internal Button import
                                        becomes relative: `./button`)
      skeleton.tsx                   ← relocated shadcn primitive (verbatim)
      tooltip.tsx                     ← relocated shadcn primitive (verbatim)
      modal.tsx                        ← existing @clensy/ui composition, moved as-is
      data-table.tsx                    ← existing @clensy/ui composition, moved as-is
      form-field.tsx                     ← existing @clensy/ui composition, moved as-is
      status-badge.tsx                    ← existing @clensy/ui composition, moved as-is
      page-header.tsx                      ← existing @clensy/ui composition, moved as-is
      loading-state.tsx                     ← existing @clensy/ui composition, moved as-is
      empty-state.tsx                        ← existing @clensy/ui composition, moved as-is
      error-state.tsx                         ← existing @clensy/ui composition, moved as-is
      detail-drawer.tsx                        ← existing @clensy/ui composition, moved as-is
      toast.tsx                                 ← existing @clensy/ui composition, moved as-is
      dialogs/
        form-dialog.tsx                          ← existing @clensy/ui composition, moved as-is
        confirm-dialog.tsx                        ← existing @clensy/ui composition, moved as-is
                                                      (variant="danger" -> "destructive", §4.4)
    domain/                                        ← new, empty (scaffolded only — §2, §5)
    internal/
      use-dialog-behavior.ts                        ← unchanged
```

Tailwind already scans `packages/ui/src` for utility classes (Web Shell spec §4.1: *"The Tailwind 4 source configuration MUST explicitly include `packages/ui/src` wherever automatic detection does not discover it"*), so no Tailwind config change is required by files moving one directory deeper within that same tree. §4.6 states precisely what `packages/ui` does and does not own regarding the token CSS itself.

**`apps/web/package.json` changes (verified against current usage, not assumed):**

- Drops `radix-ui` and `class-variance-authority` — grepped and confirmed used *only* inside the seven files being relocated; no other `apps/web` file imports either.
- Keeps `cn` — used by `apps/web/lib/utils.ts` (re-exported for `app-sidebar.tsx`'s own, non-primitive `className` composition) independent of the relocated primitives.
- Keeps `lucide-react` — used directly by all three app-shell files for their own icon needs (`Menu`, `Check`, `ChevronDown`, `ChevronLeft`, `ChevronRight`), independent of the relocated primitives.

**shadcn CLI anchor — design requirement vs. implementation investigation, kept separate:**

- *Design requirement (normative):* future shadcn component generation MUST target `packages/ui/src/base/`, not recreate primitives under `apps/web/components/ui/`. `apps/web/components.json` is not an architectural fixture of `apps/web` after this slice (§4.1).
- *Implementation investigation (M4/M6, not decided here):* determine the supported shadcn CLI configuration for this monorepo layout. If `components.json` cannot directly target a package outside the app it's invoked from, establish the smallest documented workflow that still guarantees generated primitives land in `packages/ui/src/base/` (e.g. generate into a scratch location and move, or maintain a `components.json` inside `packages/ui` itself) — and document that workflow in `packages/ui/README.md`.

### 4.4 `Button`: one component, shadcn's variant vocabulary

Two different `Button` APIs exist today and this spec collapses them into one, rather than layering a preserved-API wrapper over the relocated primitive:

- `@clensy/ui`'s current `Button`: `ButtonProps { variant?: 'danger' | 'primary' | 'secondary' }`, default `'primary'`, hardcoded classes.
- The shadcn primitive being relocated: `variant?: 'default' | 'destructive' | 'ghost' | 'link' | 'outline' | 'secondary'`, default `'default'`, plus `size` and `asChild`.

After relocation there is exactly one `Button`, exported from `@clensy/ui`, using the shadcn vocabulary above. A wrapper that re-maps `primary`/`danger` onto `default`/`destructive` would mean `packages/ui` shipping *two* `Button`-shaped things (the raw primitive other `base/` files compose, plus a second, `@clensy/ui`-branded public one) — reintroducing the two-implementations problem this spec exists to remove, one layer deeper.

`secondary` is spelled identically in both vocabularies (no consumer change needed). `primary` (today's implicit default) maps to `default` (the new implicit default) with no consumer change either — **verified by grep**, not assumed: `variant="primary"` has zero occurrences anywhere in `apps/web`. Only `variant="danger"` needs a mechanical rename to `variant="destructive"` — **verified by grep**, exactly three occurrences repository-wide: `apps/web/app/app/admin/page.tsx:161`, `apps/web/app/app/bookings/page.tsx:536`, and `packages/ui/src/confirm-dialog.tsx:50` (`ConfirmDialog`'s own confirm button, becoming `base/dialogs/confirm-dialog.tsx`).

### 4.5 App-shell consumer migration

Three files import shadcn primitives directly from `apps/web/components/ui/*` today — the pre-existing boundary violation this spec resolves as a consequence of relocating the files:

| File | Primitives imported today | After migration |
| --- | --- | --- |
| `apps/web/components/layout/dashboard-layout.tsx` | `Button` (`variant="ghost"`, `size="icon"`) | `import { Button } from '@clensy/ui'` |
| `apps/web/components/layout/app-sidebar.tsx` | `Button` (`variant="ghost"`), `Separator`, `Sheet`/`SheetContent`/`SheetTitle`, `Tooltip`/`TooltipContent`/`TooltipProvider`/`TooltipTrigger` | `import { Button, Separator, Sheet, SheetContent, SheetTitle, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@clensy/ui'` |
| `apps/web/components/layout/user-menu.tsx` | `Avatar`/`AvatarFallback`, `Button` (`variant="ghost"`), `DropdownMenu`/`DropdownMenuContent`/`DropdownMenuItem`/`DropdownMenuLabel`/`DropdownMenuSeparator`/`DropdownMenuTrigger` (one `DropdownMenuItem` uses `variant="destructive"`), `Skeleton` | `import { Avatar, AvatarFallback, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Skeleton } from '@clensy/ui'` |

Every import above is a straight path swap — no markup, prop, or variant changes, since the relocated primitives are verbatim moves (§4.2) and `ghost`/`destructive`/`outline`/`link` remain valid variants after relocation (§4.4 only renames `@clensy/ui`'s old `danger`, which the app shell never used). `apps/web/components/ui/*` is deleted once these three files (the only consumers outside `apps/web/components/ui/sheet.tsx`'s own internal `Button` import, itself relocated) are updated — **verified**: grepping every `.tsx` file in `apps/web` for an import from `@/components/ui/*` or a relative `../ui/*`/`./ui/*` path returns exactly these three files plus `sheet.tsx` itself.

### 4.6 Existing `@clensy/ui` Button consumers (the `danger` → `destructive` rename)

Every `apps/web` file that imports `Button` from `@clensy/ui` today, and its exact required change — **verified by grep**, not estimated:

| File | Current `Button` usage | Change |
| --- | --- | --- |
| `app/app/admin/page.tsx` | default variant; one `variant="danger"` (line 161) | `variant="danger"` → `variant="destructive"`; rest unchanged |
| `app/app/bookings/page.tsx` | default variant; `variant="secondary"` (lines 460, 468); `variant="danger"` (line 536) | `variant="danger"` → `variant="destructive"`; rest unchanged |
| `app/app/catalog/add-ons/page.tsx` | default variant only | No change |
| `app/app/catalog/page.tsx` | default variant only | No change |
| `app/app/cleaners/page.tsx` | default variant only | No change |
| `app/app/cleaners/teams/page.tsx` | default variant only | No change |
| `app/app/customers/page.tsx` | default variant; `variant="secondary"` (lines 512, 587) | No change |
| `app/app/jobs/page.tsx` | default variant; `variant="secondary"` (line 363) | No change |
| `app/app/laundry/page.tsx` | default variant; `variant="secondary"` (lines 502, 548, 707) | No change |
| `app/login/page.tsx` | default variant only | No change |
| `packages/ui/src/confirm-dialog.tsx` (internal, → `base/dialogs/confirm-dialog.tsx`) | `variant="secondary"` (cancel), `variant="danger"` (confirm) | `variant="danger"` → `variant="destructive"`; rest unchanged |
| `packages/ui/src/form-dialog.tsx` (internal, → `base/dialogs/form-dialog.tsx`) | `variant="secondary"` (cancel), `variant="primary"` (submit) | `variant="primary"` → no change needed (new default); rest unchanged |

No file passes `size`; the relocated primitive's `size="default"` remains the effective default throughout.

### 4.7 Who owns the theme?

This migration relocates *components*, not the theme CSS they consume. `apps/web/app/globals.css` keeps defining the semantic tokens (`--primary`, `--destructive`, `--secondary`, `--border`, …); `@clensy/ui`'s relocated primitives keep referencing them by Tailwind class name (`bg-primary`, `text-destructive`, …), exactly as they do today. This is a **CSS custom-property contract at the rendered-page level**, not a module/package dependency — `packages/ui` does not `import` anything from `apps/web` to consume these classes, and nothing about relocating the component source files changes who injects the token values.

Stated precisely, to avoid the misreading that `packages/ui` "depends on `apps/web`" architecturally: `apps/web` (today, the only application) remains responsible for injecting the application's global theme variables; `@clensy/ui`'s primitives consume those semantic tokens by class name without knowing or caring which application provided them. Token ownership is out of scope for this migration (§2) and may be revisited as its own extraction if a second application ever consumes `@clensy/ui`.

## 5. Rationale

**Why relocate all seven primitives now instead of staging Button first and the rest later?** Staging would mean `@clensy/ui` and `apps/web/components/ui` both existing as UI sources for months across several tickets, with the app shell still bypassing `@clensy/ui` in the interim — the opposite of "`apps/web` has no shadcn knowledge of its own" (§4.1). Doing it once, with all seven primitives fully enumerated (§4.2) and a fully enumerated, grep-verified consumer diff (§4.5, §4.6), is the same total mechanical work as six separate slices, without the intermediate state where this spec's central rule is still false for three files.

**Why not also migrate `Modal`/`FormDialog`/`ConfirmDialog`/`DetailDrawer` onto shadcn now, since `Sheet` is right there in `base/` after this slice?** `Sheet` being physically present doesn't make migrating `DetailDrawer` onto it free — verifying `Sheet`'s `radix-ui` `Dialog.Root`-based focus/scroll-lock/animation semantics match `DetailDrawer`'s `useDialogBehavior` hook closely enough to swap without regression is its own review. `Modal`/`FormDialog`/`ConfirmDialog` are a harder case: no shadcn `Dialog` exists in this repository at all, so "migrate onto shadcn" would mean *authoring* a new primitive — different-in-kind risk from relocating seven files whose behavior is already proven in production. Both are followed-by items (§6), not silently dropped.

**Why is `base/` flat (primitives and generic compositions together) rather than split into `base/primitives/` and `base/composition/`?** Both are "generic, business-domain-agnostic UI" from `domain/`'s perspective — the boundary this package needs to communicate is *generic vs. domain-specific*, not *shadcn-generated vs. hand-composed*. A consumer importing from `@clensy/ui` doesn't need to know or care which category a given `base/` export falls into (§4.1's rule is precisely that `apps/web` shouldn't need to know); splitting it would add a directory level that tracks an implementation detail rather than the architectural boundary that matters to callers.

**Why leave `domain/` empty instead of seeding it with an example?** No business-domain-specific component exists yet as a genuine second-consumer extraction candidate — every current `apps/web/app/**` screen still hand-rolls its own page-specific composition directly. Populating `domain/` now would mean inventing a component against a need this ticket doesn't have — the same reasoning the Phase 1 design already applied to `packages/graphql`/`auth`/`domain`/`config`/`testing` (left empty until a second consumer needs them). The directory, plus a short README note describing what belongs there, establishes the pattern without inventing unneeded code.

**Why rename `danger` to `destructive` instead of mapping it internally?** See §4.4 — a mapping wrapper reintroduces a second `Button`-shaped thing, the exact problem being removed. The rename's blast radius is three call sites, found and confirmed by grep (§4.4, §4.6), none inside a loop or generated list where a missed occurrence could hide — and §7 adds a repository-wide grep gate so a missed occurrence fails the build rather than shipping silently.

**Why does `apps/web` keep `cn`/`lucide-react` if the goal is zero shadcn knowledge?** They're general-purpose utility/icon libraries `apps/web` already uses for its *own* code, independent of any shadcn primitive — verified by grep (§4.3), not assumed. §4.1's rule is about UI components and shadcn/Radix-specific configuration, not every package a shadcn primitive happens to also depend on; banning `cn`/`lucide-react` from `apps/web` outright would be overcorrection unrelated to the actual boundary this spec establishes.

## 6. Followed-by: what this slice deliberately leaves for later

- Add a shadcn `Dialog` primitive and reconcile `Modal`/`FormDialog`/`ConfirmDialog` onto it (§2, §4.2, §5).
- Migrate `DetailDrawer` onto the now-relocated `Sheet` primitive (§2, §4.2, §5).
- Populate `packages/ui/src/domain/` with the first real domain-specific composition, once a second consumer exists (§4.3, §5).
- Consider a `no-restricted-imports` lint rule enforcing the `@clensy/ui`-only boundary at the `apps/web` app-code level (§2, §5).
- Confirm and execute the shadcn-CLI (`components.json`) repointing workflow (§4.3) — the outcome is required by this spec, the mechanism is decided at implementation time.
- Revisit theme-token ownership (§4.7) if a second application ever consumes `@clensy/ui`.

## 7. Testing and acceptance

No package in this repository has `jsdom`/`@testing-library/react` component-rendering test infrastructure today (Phase 1 Design and the Web Shell & Design System spec both scope frontend testing to unit tests over closed logic plus manual golden-path verification, not a component-test framework); this spec follows that precedent.

**Automated:** `packages/ui` gains `vitest` (node environment, mirroring `packages/validation`'s wiring — the only existing precedent for adding `vitest` to a `packages/*` workspace member) with package-level unit coverage for the relocated `Button`'s variant/size class contract and prop passthrough (`className`/`type`/arbitrary DOM props), verifying each of `default`/`secondary`/`destructive`/`outline`/`ghost`/`link` and that the omitted-variant default is `default`. Implementation picks the lightest mechanism compatible with the existing code (e.g. asserting directly against `buttonVariants`'s resolved output, or server-rendered markup) — not prescribed here.

**Grep-verifiable acceptance gates** (cheap, regression-proof, run as part of the PR):

- No `variant="danger"` or `variant='danger'` remains anywhere in the repository.
- No `variant="primary"` or `variant='primary'` remains anywhere in the repository (should already be true pre-migration — confirms nothing regressed).
- No import from `apps/web/components/ui/*` (relative or `@/components/ui/*`) remains anywhere in `apps/web`.
- `apps/web/components/ui/` no longer exists as a directory.

**Build gates:** `pnpm --filter @clensy/ui build` (`tsc --noEmit`), `pnpm --filter @clensy/ui lint`, `pnpm --filter web build`, and `pnpm --filter web lint` all succeed.

**Manual golden path:**

1. Module screens: `/login`, `/app/customers` (create/edit dialogs, `secondary` cancel buttons), `/app/bookings`, `/app/catalog`, `/app/catalog/add-ons`, `/app/cleaners`, `/app/cleaners/teams`, `/app/jobs`, `/app/laundry`, `/app/admin` — confirm the renamed `destructive` actions in `admin`/`bookings` still render and behave as the old `danger` variant did; everything else renders identically (token-based restyle only).
2. App shell: mobile-nav toggle (`dashboard-layout.tsx`), sidebar collapse/expand button, collapsed-sidebar tooltips, mobile `Sheet` drawer open/close (`app-sidebar.tsx`), user menu dropdown (avatar, theme options with the check-mark indicator, sign-out `destructive` item, loading `Skeleton`) (`user-menu.tsx`) — confirm every one of these still renders and behaves identically, now sourced from `@clensy/ui`.

## 8. Non-goals

- Adding a shadcn `Dialog` primitive or migrating `Modal`/`FormDialog`/`ConfirmDialog` onto one (§2, §6).
- Migrating `DetailDrawer` onto `Sheet` (§2, §6).
- Populating `packages/ui/src/domain/` with any component (§2, §5, §6).
- Relocating the theme CSS variables themselves (§2, §4.7).
- A `no-restricted-imports` lint rule enforcing the boundary (§2, §6).
- Introducing `jsdom`/`@testing-library/react` or any component-rendering test framework (§2, §7).
- Visual/UX redesign of any migrated screen beyond the token-based restyle and the enumerated `danger`→`destructive` rename (§2).
- Adding new variants, sizes, or props to any relocated primitive beyond what it already has today.

## 9. Acceptance criteria (for this specification)

- States one clear rule, framed with `@clensy/ui` (not shadcn) as the architecture, and where it is documented (§4.1).
- Accounts for every one of the seven existing shadcn primitives and every existing `@clensy/ui` composition, with an explicit disposition for each (§4.2).
- Resolves the physical workspace-dependency conflict between "shadcn primitives" and "`packages/ui` can't import `apps/web`" concretely, by relocation rather than assertion (§4.3).
- Separates the theme-token consumption relationship from a module/package dependency, explicitly (§4.7).
- Resolves the `Button` API-collision question explicitly (one component, shadcn's vocabulary, enumerated and grep-verified rename) rather than leaving it for M4/M6 to discover (§4.4, §4.6).
- Accounts for every consumer of every relocated primitive, verified by grep rather than estimated, both the pre-existing `@clensy/ui` consumers and the three app-shell files that bypassed it (§4.5, §4.6).
- States, with rationale, exactly what is deliberately deferred and why, distinguishing "relocate an existing file" work from "author a new primitive" work (§5, §6).
- Defines a testing and acceptance bar consistent with this repository's existing testing precedent, including cheap grep-based regression gates (§7).
