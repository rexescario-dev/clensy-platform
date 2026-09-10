# Web Application Shell & Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `apps/web` a Tailwind 4 + shadcn shell (tokens, themed `ShellChrome`, `BrandMark`, composed sidebar/header/user menu) without changing navigation IA, GraphQL, or module UX beyond necessary Tailwind 4 compatibility fixes.

**Architecture:** shadcn and semantic tokens live only in `apps/web`. `DashboardLayout` replaces `AppShell` in place. `.dark` is applied only on the shell chrome subtree (never `html`/`body`). `/app/*` `<main>` stays a light content island. `@clensy/ui` stays the module toolkit.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, current shadcn/ui (New York, zinc/neutral, CSS variables), Vitest (logic tests only), existing `@clensy/client` + `@clensy/ui`.

**Spec:** [docs/superpowers/specs/2026-09-10-web-shell-and-design-system-design.md](../specs/2026-09-10-web-shell-and-design-system-design.md) (Accepted). Where this plan and the spec disagree, the spec wins.

**Revision (plan review):** removed prescribed `ShellChrome` inline-script bootstrap and overlapping grid/pointer-events layout; Task 3 inspects the existing Tailwind/PostCSS graph before changing packages; Sheet/Dropdown/Tooltip portals are specified by theme-containment result; `presentRole` uses a typed ownership check; Task 10 adds portal isolation and a clean-tree check. The spec remains authoritative for BrandMark geometry.

## Global Constraints

- SHALL NOT apply `.dark`, `data-theme="dark"`, `color-scheme: dark`, or equivalent dark-theme state to `html` or `body`.
- SHALL theme only `ShellChrome` and shell-owned portals; `/app/*` `<main>` MUST remain outside that subtree and always light.
- SHALL NOT change `CurrentAdmin`, `logout`, session cookies, Apollo setup, or logout error handling.
- SHALL NOT rewrite `apps/web/next.config.ts` `redirects()`.
- SHALL keep `/app` → `/app/customers`, `/login` public with no theme UI, `middleware.ts` cookie-presence semantics.
- SHALL keep current `NAV_GROUPS` labels and hrefs; longest-prefix active state; `clensy.sidebar.collapsed`.
- SHALL add only shadcn primitives: `Button`, `Avatar`, `DropdownMenu`, `Separator`, `Sheet`, `Tooltip`, `Skeleton`. SHALL NOT add shadcn `Sidebar` kit, Command, Card, Table, Tabs, Dialog, Badge, or a notifications control.
- SHALL NOT put shadcn in `packages/ui`.
- SHALL use one CSS-first Tailwind 4 pipeline; MUST explicitly `@source` `packages/ui/src` if auto-detection misses it; MUST verify `@clensy/ui` utilities still emit.
- Identity: closed role map only; no UUID, fake name, email, or Profile/Settings.
- Theme: `light` | `dark` | `system`; default `system`; persist `clensy.theme`; System follows live OS changes; no light→dark flash; no document-root theme helper.
- Compatibility fixes that would change module visual/behavioral intent MUST stop and escalate.
- SHALL NOT add Playwright.

---

## File structure

| Path | Responsibility |
| --- | --- |
| `apps/web/lib/role-presentation.ts` | Closed `Role` → `{ label, initials }` map |
| `apps/web/lib/role-presentation.test.ts` | Unit tests for that map |
| `apps/web/lib/theme-preference.ts` | Parse storage + resolve appearance |
| `apps/web/lib/theme-preference.test.ts` | Unit tests for theme resolution |
| `apps/web/lib/nav-groups.ts` | `NAV_GROUPS` + `findActiveHref` (moved from sidebar) |
| `apps/web/lib/nav-groups.test.ts` | Longest-prefix active href |
| `apps/web/lib/use-sidebar-collapsed.ts` | Unchanged key `clensy.sidebar.collapsed` |
| `apps/web/lib/utils.ts` | shadcn `cn()` helper |
| `apps/web/components/ui/*` | Allowed shadcn primitives only |
| `apps/web/components/layout/brand-mark.tsx` | Presentational `BrandMark` |
| `apps/web/components/layout/shell-chrome.tsx` | Theme root; pre-paint behavior, mechanism inspect-then-choose |
| `apps/web/components/layout/app-sidebar.tsx` | Desktop rail + BrandMark + nav |
| `apps/web/components/layout/app-header.tsx` | Mobile trigger + UserMenu |
| `apps/web/components/layout/user-menu.tsx` | Identity + theme + logout |
| `apps/web/components/layout/dashboard-layout.tsx` | Replaces `AppShell` |
| `apps/web/app/app/layout.tsx` | Mounts `DashboardLayout` |
| `apps/web/app/globals.css` | Tailwind 4 + zinc tokens |
| `apps/web/postcss.config.mjs` | `@tailwindcss/postcss` |
| `apps/web/components.json` | shadcn config |
| `apps/web/vitest.config.ts` | Logic tests |
| Delete `apps/web/components/app-shell/*` | After `DashboardLayout` lands |
| Delete `apps/web/tailwind.config.ts` | After CSS-first pipeline works |

**Must remain untouched except TW4 scan/compat:** `apps/api/**`, `packages/client/**` (no codegen), GraphQL operations, `middleware.ts` behavior, `next.config.ts` redirects, module `page.tsx` files (unless a TW4 utility breaks), `@clensy/ui` primitives (unless a TW4 utility breaks).

---

### Task 1: Role presentation map

**Files:**
- Create: `apps/web/lib/role-presentation.ts`
- Test: `apps/web/lib/role-presentation.test.ts`
- Create: `apps/web/vitest.config.ts`
- Modify: `apps/web/package.json` (add `vitest` devDependency and `"test": "vitest run"`)

**Interfaces:**
- Consumes: `Role` from `@clensy/client` (`'ANALYST' \| 'CUSTOMER_SUPPORT' \| 'FINANCE' \| 'OPS_MANAGER' \| 'OWNER' \| 'SCHEDULER'`)
- Produces: `presentRole(role: string \| null \| undefined): { label: string; initials: string } \| undefined`

- [ ] **Step 1: Add Vitest**

From repo root:

```bash
pnpm --filter web add -D vitest
```

Set `apps/web/package.json` scripts `"test": "vitest run"`.

`apps/web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
```

- [ ] **Step 2: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { presentRole } from './role-presentation';

const CASES = [
  ['OWNER', 'Owner', 'OW'],
  ['OPS_MANAGER', 'Ops Manager', 'OM'],
  ['SCHEDULER', 'Scheduler', 'SC'],
  ['CUSTOMER_SUPPORT', 'Customer Support', 'CS'],
  ['FINANCE', 'Finance', 'FI'],
  ['ANALYST', 'Analyst', 'AN'],
] as const;

describe('presentRole', () => {
  it.each(CASES)('%s → %s / %s', (role, label, initials) => {
    expect(presentRole(role)).toEqual({ label, initials });
  });

  it('returns undefined for null, undefined, empty, and unknown', () => {
    expect(presentRole(null)).toBeUndefined();
    expect(presentRole(undefined)).toBeUndefined();
    expect(presentRole('')).toBeUndefined();
    expect(presentRole('SUPERADMIN')).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL** (`presentRole` not defined)

```bash
pnpm --filter web test
```

- [ ] **Step 4: Implement**

```ts
import type { Role } from '@clensy/client';

const ROLE_PRESENTATION: Record<Role, { label: string; initials: string }> = {
  OWNER: { label: 'Owner', initials: 'OW' },
  OPS_MANAGER: { label: 'Ops Manager', initials: 'OM' },
  SCHEDULER: { label: 'Scheduler', initials: 'SC' },
  CUSTOMER_SUPPORT: { label: 'Customer Support', initials: 'CS' },
  FINANCE: { label: 'Finance', initials: 'FI' },
  ANALYST: { label: 'Analyst', initials: 'AN' },
};

function isPresentedRole(role: string): role is Role {
  return Object.prototype.hasOwnProperty.call(ROLE_PRESENTATION, role);
}

export function presentRole(
  role: string | null | undefined,
): { label: string; initials: string } | undefined {
  if (!role || !isPresentedRole(role)) return undefined;
  return ROLE_PRESENTATION[role];
}
```

Keep `Record<Role, …>` so missing enum members fail typecheck. Do not add a default/fallback identity. Do not use `role as Role`.

- [ ] **Step 5: Run tests — expect PASS**

```bash
pnpm --filter web test
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/role-presentation.ts apps/web/lib/role-presentation.test.ts apps/web/vitest.config.ts apps/web/package.json pnpm-lock.yaml
git commit -m "test(web): add closed CurrentAdmin role presentation map"
```

---

### Task 2: Theme preference resolution

**Files:**
- Create: `apps/web/lib/theme-preference.ts`
- Test: `apps/web/lib/theme-preference.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1
- Produces:
  - `THEME_STORAGE_KEY = 'clensy.theme'`
  - `ThemePreference = 'light' \| 'dark' \| 'system'`
  - `ResolvedAppearance = 'light' \| 'dark'`
  - `parseThemePreference(stored: string \| null): ThemePreference`
  - `resolveAppearance(preference: ThemePreference, prefersColorSchemeDark: boolean): ResolvedAppearance`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  parseThemePreference,
  resolveAppearance,
  THEME_STORAGE_KEY,
} from './theme-preference';

describe('parseThemePreference', () => {
  it('defaults missing and invalid values to system', () => {
    expect(parseThemePreference(null)).toBe('system');
    expect(parseThemePreference('')).toBe('system');
    expect(parseThemePreference('auto')).toBe('system');
    expect(parseThemePreference('DARK')).toBe('system');
  });

  it('accepts light, dark, and system', () => {
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference('system')).toBe('system');
  });
});

describe('resolveAppearance', () => {
  it('light and dark ignore OS', () => {
    expect(resolveAppearance('light', true)).toBe('light');
    expect(resolveAppearance('light', false)).toBe('light');
    expect(resolveAppearance('dark', true)).toBe('dark');
    expect(resolveAppearance('dark', false)).toBe('dark');
  });

  it('system follows prefers-color-scheme', () => {
    expect(resolveAppearance('system', true)).toBe('dark');
    expect(resolveAppearance('system', false)).toBe('light');
  });
});

describe('THEME_STORAGE_KEY', () => {
  it('is clensy.theme', () => {
    expect(THEME_STORAGE_KEY).toBe('clensy.theme');
  });
});
```

- [ ] **Step 2: Run `pnpm --filter web test` — expect FAIL**

- [ ] **Step 3: Implement**

```ts
export const THEME_STORAGE_KEY = 'clensy.theme';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedAppearance = 'light' | 'dark';

export function parseThemePreference(stored: string | null): ThemePreference {
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

export function resolveAppearance(
  preference: ThemePreference,
  prefersColorSchemeDark: boolean,
): ResolvedAppearance {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return prefersColorSchemeDark ? 'dark' : 'light';
}
```

- [ ] **Step 4: Run `pnpm --filter web test` — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/theme-preference.ts apps/web/lib/theme-preference.test.ts
git commit -m "test(web): add shell theme preference resolution"
```

---

### Task 3: Tailwind 4 pipeline and zinc tokens

**Files:**
- Modify: `apps/web/package.json`, `apps/web/postcss.config.mjs`, `apps/web/app/globals.css`
- Delete: `apps/web/tailwind.config.ts` (only after CSS-first pipeline builds)
- Modify: `apps/web/app/layout.tsx` only if required to keep `globals.css` imported (it already is)

**Interfaces:**
- Consumes: none
- Produces: CSS-first Tailwind 4; `:root` light zinc tokens; `.dark` dark zinc tokens; `@source` of `packages/ui/src`

- [ ] **Step 1: Inspect the existing Tailwind/PostCSS graph before changing packages**

Read:

```text
apps/web/package.json
apps/web/tailwind.config.ts
apps/web/postcss.config.mjs
apps/web/app/globals.css
apps/web/app/layout.tsx
apps/web/next.config.ts
packages/ui/package.json
packages/ui/src/**
Dockerfile.web
pnpm-workspace.yaml
```

Confirm: current Tailwind/PostCSS versions; how `@clensy/ui` classes are discovered today (`content` in `tailwind.config.ts`); whether `autoprefixer` is required by any remaining web config (PostCSS, Next, other CSS tools) or only as a Tailwind 3 companion; existing CSS imports; whether module classes depend on `theme.extend` in the JS config (today it is empty); Docker copies `apps/web` via the repo-root `Dockerfile.web` build context.

- [ ] **Step 2: Replace the Tailwind 3 PostCSS pipeline with the Tailwind 4 pipeline**

Keep `tailwindcss` as a dependency; update it to v4 as required rather than remove-then-readd. Add `@tailwindcss/postcss`. Remove `autoprefixer` **only if** Step 1 showed it is unused after the Tailwind 4 plugin replaces that pipeline.

Point `apps/web/postcss.config.mjs` at `@tailwindcss/postcss` as the Tailwind processor (exact plugin object follows current Tailwind 4 docs after inspection).

- [ ] **Step 3: Replace `globals.css` with Tailwind 4 + shadcn zinc variables**

Use the current shadcn zinc CSS-variable block for Tailwind 4 (`@import "tailwindcss"`, `@theme inline` mapping `--color-background` etc. to `--background`, plus `:root` and `.dark` HSL/OKLCH pairs). Keep `:root` as the **light** set. Include:

```css
@import "tailwindcss";

/* Required: @clensy/ui lives outside apps/web; TW4 will not scan it automatically. */
@source "../../../packages/ui/src/**/*.{ts,tsx}";

@source "../components/**/*.{ts,tsx}";
@source "./**/*.{ts,tsx}";
```

Adjust `@source` paths relative to `apps/web/app/globals.css` so they resolve to `packages/ui/src` and `apps/web` TSX. If the shadcn CLI later rewrites this file, **re-add the `packages/ui` `@source` immediately**.

Set `--radius: 0.5rem`.

Do **not** add `color-scheme: dark` on `html`/`body`. Do **not** put `class="dark"` on `html` in `app/layout.tsx`.

- [ ] **Step 4: Delete `tailwind.config.ts`**

Do not leave it as a second source of truth.

- [ ] **Step 5: Build and verify `@clensy/ui` utilities emit**

```bash
pnpm --filter web build
```

Expected: success.

Then search the emitted CSS (under `apps/web/.next`) for a class unique to `@clensy/ui` that module pages use, e.g. `hover:bg-slate-700` from `packages/ui/src/button.tsx`. If it is missing, the `@source` path is wrong — fix the path, do not restyle `@clensy/ui`.

If a Tailwind 4 rename breaks a class in `@clensy/ui` or a module page, apply the **smallest** equivalent utility that preserves visual intent. If that is not possible without a redesign, **stop** (spec §4.10).

- [ ] **Step 6: `pnpm --filter web lint` and `pnpm --filter web test`**

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/postcss.config.mjs apps/web/app/globals.css pnpm-lock.yaml
git add -u apps/web/tailwind.config.ts
git commit -m "chore(web): upgrade Tailwind 4 with zinc tokens and @clensy/ui source scan"
```

---

### Task 4: shadcn primitives (allowlist only)

**Files:**
- Create: `apps/web/components.json`, `apps/web/lib/utils.ts`
- Create via CLI: `apps/web/components/ui/{button,avatar,dropdown-menu,separator,sheet,tooltip,skeleton}.tsx` (exact filenames follow the CLI)

**Interfaces:**
- Consumes: Task 3 tokens
- Produces: those seven primitives; `cn()` in `lib/utils.ts`

- [ ] **Step 1: Init shadcn for this Next app**

From `apps/web` (or repo root with the correct `--cwd`):

```bash
pnpm dlx shadcn@latest init
```

Choose: New York, zinc/neutral, CSS variables, RSC, `apps/web/app/globals.css`, aliases `@/components`, `@/lib/utils`, `@/components/ui`. If the CLI offers a document-level darkMode strategy, do **not** configure it to toggle `html`.

If `init` overwrites `globals.css`, restore Task 3's `@source` for `packages/ui/src` and confirm `:root` stays light-only.

- [ ] **Step 2: Add only the allowed components**

```bash
pnpm dlx shadcn@latest add button avatar dropdown-menu separator sheet tooltip skeleton
```

Do **not** add `sidebar`, `command`, `card`, `table`, `tabs`, `dialog`, `badge`.

- [ ] **Step 3: Confirm `components/ui` contains only those primitives** (plus any tiny `_` internals the CLI adds for them, e.g. sheet overlay). Remove anything extra.

- [ ] **Step 4: `pnpm --filter web build` and `pnpm --filter web test`**

- [ ] **Step 5: Commit**

```bash
git add apps/web/components.json apps/web/lib/utils.ts apps/web/components/ui apps/web/app/globals.css apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add allowlisted shadcn primitives for the app shell"
```

---

### Task 5: BrandMark

**Files:**
- Create: `apps/web/components/layout/brand-mark.tsx`

**Interfaces:**
- Consumes: Task 3 tokens; Task 4 not required (can be a `div` + optional `mark` slot)
- Produces: `BrandMark({ mark?: ReactNode; name: string; tagline?: string; compact?: boolean })`

- [ ] **Step 1: Implement `BrandMark`**

Default mark: a small implementation-defined geometric/iconographic mark using shell semantic tokens only. MUST NOT introduce a brand-specific color, external image asset, remote resource, or tenant data.

When `compact` is true: hide `name`/`tagline` visually (`sr-only` or equivalent). If the parent nav already has `aria-label="Primary"`, do **not** also put `aria-label="Clensy"` on the BrandMark root (avoids duplicate names). Use visually hidden text inside the mark only if the landmark does not already name the product.

Call-site defaults (later tasks): `name="Clensy"` `tagline="Laundry"`.

- [ ] **Step 2: `pnpm --filter web lint`**

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/brand-mark.tsx
git commit -m "feat(web): add presentational BrandMark for shell chrome"
```

---

### Task 6: ShellChrome theme root (no document theming)

**Files:**
- Create: `apps/web/components/layout/shell-chrome.tsx`

**Interfaces:**
- Consumes: `THEME_STORAGE_KEY`, `parseThemePreference`, `resolveAppearance` from Task 2
- Produces: `ShellChrome({ children: ReactNode; className?: string })` — the only theme root. Optional stable `id` for portal scoping (e.g. `clensy-shell-chrome`) is fine; theme updates MUST go through the component (ref/context/className), not `document.querySelector` as the primary runtime path.

- [ ] **Step 1: Inspect the existing Next.js App Router tree** (`apps/web/app/layout.tsx`, `apps/web/app/app/layout.tsx`, client vs server components) then implement a shell-scoped theme provider/root that resolves `light | dark | system` without modifying `html` or `body`.

The implementation MUST establish the resolved class on the `ShellChrome` root before its themed descendants become visibly painted, including the initial dark-system case.

The implementation MAY use a minimal server-rendered/client bootstrap technique appropriate to the existing Next.js App Router structure. It MUST NOT use `html`, `body`, `document.documentElement`, or a document-root theme provider as the theme target. Do not install `next-themes` unless inspection shows it can target the chrome root only (default document-root mode is forbidden).

After hydration, preference changes and `prefers-color-scheme` changes MUST update the shell root. Expose React context `{ preference, setPreference, resolved }` for UserMenu. `setPreference` persists `clensy.theme`.

Do **not** prescribe an inline `<script>` first-child inside `ShellChrome`, `document.currentScript`, or treating the React tree as a document bootstrapper.

- [ ] **Step 2: `pnpm --filter web lint`.** Pre-paint/no-flash and portal checks are Task 10.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/shell-chrome.tsx
git commit -m "feat(web): add ShellChrome as the only theme root"
```

---

### Task 7: Nav groups + composed sidebar + mobile Sheet

**Files:**
- Create: `apps/web/lib/nav-groups.ts`, `apps/web/lib/nav-groups.test.ts`
- Create: `apps/web/components/layout/app-sidebar.tsx`
- Keep: `apps/web/lib/use-sidebar-collapsed.ts` (do not change the storage key)

**Interfaces:**
- Consumes: `BrandMark`; shadcn `Button`, `Separator`, `Sheet`, `Tooltip`; `useSidebarCollapsed`; `ShellChrome` as ancestor
- Produces: `NAV_GROUPS`, `findActiveHref(pathname: string): string | undefined`, `AppSidebar({ mobileNavOpen, onMobileNavClose })`

- [ ] **Step 1: Move nav data + `findActiveHref` and test longest prefix**

Copy hrefs/labels **verbatim** from current `apps/web/components/app-shell/sidebar.tsx` (`NAV_GROUPS` as of this plan). Test:

```ts
expect(findActiveHref('/app/cleaners/teams')).toBe('/app/cleaners/teams');
expect(findActiveHref('/app/cleaners')).toBe('/app/cleaners');
expect(findActiveHref('/app/catalog/add-ons')).toBe('/app/catalog/add-ons');
expect(findActiveHref('/login')).toBeUndefined();
```

- [ ] **Step 2: `pnpm --filter web test` — red then green**

- [ ] **Step 3: Implement `AppSidebar`**

Desktop `md:`: width `w-56` expanded / `w-16` collapsed; BrandMark `compact={collapsed}`; group labels hidden when collapsed; Tooltip on collapsed items; collapse control at the bottom; `aria-label="Primary"`.

Mobile: shadcn `Sheet` instead of the handmade drawer. Open/close from props. `usePathname` effect calls `onMobileNavClose` on route change. Closed sheet must be inert. Focus trap while open; restore focus on close.

Shell-owned Sheet, DropdownMenu, and Tooltip portal content MUST remain within the shell's theme boundary. After generating each shadcn primitive, inspect its portal implementation and adapt composition so overlay/content receives the shell's resolved theme without applying theme state to `html` or `body`. Verify the resulting DOM; do not assume the generated primitive's default portal target is acceptable, and do not prescribe a particular `container` / `Portal` API.

Do not install shadcn Sidebar.

- [ ] **Step 4: `pnpm --filter web lint`**

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/nav-groups.ts apps/web/lib/nav-groups.test.ts apps/web/components/layout/app-sidebar.tsx
git commit -m "feat(web): compose themed sidebar from current NAV_GROUPS"
```

---

### Task 8: Header + UserMenu

**Files:**
- Create: `apps/web/components/layout/app-header.tsx`
- Create: `apps/web/components/layout/user-menu.tsx`

**Interfaces:**
- Consumes: `presentRole`; `ShellThemeContext`; `useCurrentAdminQuery`, `useLogoutMutation`, `useApolloClient` from `@clensy/client` (same as today's `user-menu.tsx`); shadcn `Avatar`, `Button`, `DropdownMenu`, `Skeleton`
- Produces: `AppHeader({ children?: ReactNode })`, `UserMenu`

Copy logout flow from `apps/web/components/app-shell/user-menu.tsx` **without changing it**: success `clearStore` + `router.replace('/login')`; failure inline `Unable to log out. Please try again.`; do not navigate or clear cache on failure.

- [ ] **Step 1: Implement `UserMenu`**

- Loading: `Skeleton` in the identity slot.
- Loaded with mapped role: Avatar initials + label; dropdown: role label; Light / Dark / System (mark current `preference`); Sign out.
- Unmapped/missing `currentAdmin`: no initials, no label, no fake "User".
- Theme items call `setPreference` only.
- Use shadcn `Button` in the chrome, not `@clensy/ui` `Button`.
- DropdownMenu portal: same theme-containment result as Task 7 (inspect generated primitive; verify DOM).

- [ ] **Step 2: Implement `AppHeader`** — token borders/background; `md:hidden` slot for mobile trigger; `UserMenu` on the right.

- [ ] **Step 3: `pnpm --filter web lint`**

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/layout/app-header.tsx apps/web/components/layout/user-menu.tsx
git commit -m "feat(web): add shell header UserMenu with role identity and theme control"
```

---

### Task 9: DashboardLayout replaces AppShell

**Files:**
- Create: `apps/web/components/layout/dashboard-layout.tsx`
- Modify: `apps/web/app/app/layout.tsx`
- Delete: `apps/web/components/app-shell/app-shell.tsx`, `header.tsx`, `sidebar.tsx`, `user-menu.tsx`

**Interfaces:**
- Consumes: `ToastProvider` from `@clensy/ui` (keep wrapping the same overall tree); `ShellChrome`, `AppSidebar`, `AppHeader`
- Produces: `DashboardLayout({ children })`

- [ ] **Step 1: Implement `DashboardLayout`**

Implement `DashboardLayout` such that `ShellChrome` and `<main>` are **sibling** elements. Sidebar and header MUST be descendants of `ShellChrome`. `<main>` MUST NOT be inside the themed subtree.

The layout MUST provide the existing desktop sidebar/header/content arrangement (and the existing mobile header + content arrangement) without placing `<main>` inside `ShellChrome`.

The exact CSS layout mechanism (flex, grid, CSS variables, etc.) is implementation-defined. Choose the simplest structure that preserves current shell behavior after inspecting `apps/web/components/app-shell/app-shell.tsx`.

Do not use overlapping layers, pointer-event suppression, or duplicated layout surfaces merely to satisfy the theme boundary unless repository inspection demonstrates that no simpler structure can preserve the existing shell behavior.

```text
outer (unthemed)
├── ShellChrome          ← theme root
│   ├── sidebar
│   └── header
└── main                 ← light island, sibling
```

`AppHeader` children: shadcn `Button` `aria-label="Toggle navigation menu"`. Keep `@clensy/ui` `ToastProvider` wrapping the outer layout (toasts stay light with the island).

Hardcoded light surface classes on `main` are allowed: it is the **legacy island**, not new shell chrome.

- [ ] **Step 2: Point `apps/web/app/app/layout.tsx` at `DashboardLayout`. Do not add a second layout.**

- [ ] **Step 3: Delete `apps/web/components/app-shell/*` after nothing imports it.**

- [ ] **Step 4: `pnpm --filter web build` `pnpm --filter web test` `pnpm --filter web lint`**

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/layout/dashboard-layout.tsx apps/web/app/app/layout.tsx
git add -u apps/web/components/app-shell
git commit -m "feat(web): replace AppShell with themed DashboardLayout"
```

---

### Task 10: Build, Docker, manual golden path

**Files:** none new unless a TW4 compatibility fix is required (then only the broken utility, smallest change).

- [ ] **Step 1: `pnpm --filter web lint && pnpm --filter web test && pnpm --filter web build`**

- [ ] **Step 2: `docker compose build web` (or `Dockerfile.web`) must succeed**

- [ ] **Step 3: Manual golden path (spec §6)**

1. Signed out: `/` and `/app` → `/login`. No theme control on login.
2. Signed in: `/app` → `/app/customers`. Every §4.7 href loads the same module as before.
3. Desktop collapse persists `clensy.sidebar.collapsed`; compact BrandMark is mark-only.
4. Mobile Sheet: focus trap, close on navigate, inert when closed.
5. User menu: role + initials only; logout success → `/login`; failed logout stays + same error copy.
6. Theme Light/Dark/System persist `clensy.theme`; System follows OS. In DevTools, `html` and `body` never have `.dark` / `data-theme="dark"`. Reload with OS dark + System: chrome must not flash light.
7. **Portal isolation:** with shell Dark (or System resolving dark): UserMenu dropdown and mobile Sheet MUST render dark. A module-owned `@clensy/ui` dialog/drawer opened from Customers (or any `/app/*` page) MUST stay light. Toasts from `ToastProvider` stay light.
8. Old `/customers` redirect still works.
9. If a remaining TW4 issue would change module intent, stop and escalate — do not redesign.

- [ ] **Step 4: Clean tree**

```bash
git status --short
```

Only intentional Slice 1 files. Confirm no shadcn/`components.json`/theme artifacts under `packages/ui` or `apps/api`.

- [ ] **Step 5: Commit only if Step 3 required a compatibility fix**

```bash
git commit -m "fix(web): Tailwind 4 compatibility for remaining @clensy/ui utilities"
```

Otherwise no commit.

---

## Spec coverage

| Spec | Task |
| --- | --- |
| Role map + fail closed | 1, 8 |
| Theme parse/resolve + storage key | 2, 6, 8 |
| Tailwind 4 CSS-first, zinc, `@source` packages/ui | 3 |
| shadcn allowlist / no Sidebar kit | 4, 7 |
| BrandMark | 5 |
| Theme root, no html/body, no-flash, portals | 6, 7, 9 |
| NAV_GROUPS unchanged, collapse key, Sheet | 7 |
| UserMenu identity + logout contract + theme control | 8 |
| Replace AppShell, main island | 9 |
| `/app` redirect, next.config redirects, middleware | 9–10 (must not edit) |
| Lint/build/Docker + golden path + portal isolation + clean tree | 10 |
| No Playwright, no API, no dashboard, no IA | all |

## Type consistency

- `ThemePreference` / `ResolvedAppearance` / `THEME_STORAGE_KEY` — Task 2, used in 6 and 8
- `presentRole` — Task 1, used in 8
- `NAV_GROUPS` / `findActiveHref` — Task 7
- `ShellChrome` / `#clensy-shell-chrome` — Tasks 6–9
- `DashboardLayout` — Task 9
