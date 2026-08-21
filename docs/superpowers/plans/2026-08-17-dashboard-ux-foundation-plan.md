# Dashboard UX Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `apps/web` one authenticated route boundary (`/app/*`), one shared application shell, and a small set of reusable `packages/ui` primitives (`DataTable`, `Modal`, `FormDialog`, `ConfirmDialog`, `DetailDrawer`, `PageHeader`, feedback states), then migrate the four existing route areas (Customers, Cleaners/Teams, Catalog, Admin) onto them.

**Architecture:** One new API mutation (`logout`) closes the only backend gap. Three `packages/ui` slices build the primitives bottom-up (base `Modal` → dialogs/drawer that compose it → `DataTable` extension, independent of the others). Four `apps/web` slices then build the shell once (against the simplest module, Admin) and migrate the remaining three modules onto it, each slice redirecting its own old URLs as it lands so the app never sits in a broken intermediate state on `main`. A final slice runs the exact golden path the Accepted spec's acceptance criteria demand.

**Tech Stack:** NestJS/GraphQL (`apps/api`), Next.js App Router + Apollo Client (`apps/web`), React + Tailwind (`packages/ui`), `graphql-codegen` (`packages/client`). No new dependencies.

## Plan identity

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-08-17 |
| Tracking issue | [#24](https://github.com/rexescario-dev/clensy-platform/issues/24) |
| Milestone | M5 — Dashboard UX Foundation |
| Package/repo scope | `apps/api/src/modules/admins` (one mutation only), `packages/client`, `packages/ui`, `apps/web` |
| Depends on (Accepted) | [Dashboard UX Foundation Design](../specs/2026-08-17-dashboard-ux-foundation-design.md) — **Accepted**; [Phase 1 Design](../specs/2026-08-14-clensy-platform-phase1-design.md) — **Accepted** |

**Authoritative-input rule:** the Accepted design spec is authoritative. Where this plan and the spec disagree, the spec wins and this plan must be revised — no task below invents product semantics beyond what the spec's §4 already locked (route table, prop contracts, logout flow, migration scope).

**Revision (M5 round 1):** Two findings from the first plan review cited the spec's pre-M3-fix text (`/app/customers/[id]` nested routes; "failure → `router.push('/login')` regardless") — verified against the live, committed, Accepted spec (`docs/superpowers/specs/2026-08-17-dashboard-ux-foundation-design.md`, commit `6fa57b5`, Status: Accepted) and confirmed both are already exactly what this plan implements: §4.1/§4.4/§4.7/§5 specify the `?detail=` search-param model (not nested `[id]` routes), and §4.3 specifies success-only navigation with failure showing an inline error and not navigating. No plan change was needed for either — see the response accompanying this revision for the full verification. Everything else in the review was a genuine plan-quality finding and is fixed here: Task 5's `/app` redirect no longer targets the not-yet-migrated Customers module (temporarily targets `/app/admin`, changed in Task 6); `useToast()`'s API is now consistently `success`/`error` everywhere it's used; the `DataTable` caller count is corrected to match its actual 5 call sites; Task 1's TDD steps are reordered to genuine red→green; `DetailDrawer`'s inertness requirement is now stated as a behavior with a suggested-not-mandated mechanism; `ConfirmDialog` is now wired into Admin's existing unconfirmed "Disable" action rather than shipped with zero consumers; Task 5 gains an explicit route-tree verification step and a concrete mobile-sidebar-drawer implementation; the `PageHeader`/`Header` slot mechanism is now explicit; and `Modal`'s focus-restore behavior is specified precisely.

**Revision (M5 round 2, Accepted):** `DetailDrawer` now consumes a new internal, unexported `useDialogBehavior` hook directly (shared with `Modal`) instead of "composing" the public `Modal` component, which had no prop for a right-side layout or non-dimmed backdrop; Task 8's commit steps stage the moved `format-price.ts`; Task 5's route-tree verification checks actual `page.tsx` files, not directories; `logout`'s cookie-clearing now reads a `SESSION_COOKIE_OPTIONS` constant shared with `login`'s existing `setSessionCookie` instead of duplicating its attributes as independent literals; and the logout-failure message is local component state on the user menu (matching spec §4.3's literal "inline message on the user menu"), not routed through `useToast`. Status: Accepted. Ready for M6 Implementation.

## 1. Delivery intent

Implement exactly what the Accepted spec's §2 "In scope" describes: route reorganization under `/app/*` with permanent old-path redirects, a shared shell (sidebar/header/user menu/logout), the seven `packages/ui` primitives of §4.4, one new `logout` mutation, and migration of the Customers, Cleaners/Teams, Catalog, and Admin screens onto all of the above. Nothing here redesigns the product — it delivers the UX architecture the spec already decided.

## Global Constraints

Copied verbatim in meaning from the Accepted spec; every task below implicitly includes these.

- SHALL move all authenticated routes under `/app/*`; `/login` (and future auth pages) SHALL NOT render the shell (spec §2, §4.1, §4.8).
- SHALL redirect every old protected URL to its `/app/*` equivalent permanently, via `next.config.ts` redirects or thin server-redirect pages — not client-side-only navigation (spec §4.1).
- Entities that get a `DetailDrawer` SHALL NOT get an `/app/*` `[id]` route — old `[id]` paths redirect straight to `?detail=[id]` on the list page (spec §4.1, §4.4).
- `middleware.ts` SHALL use a single `/app/:path*` matcher and SHALL NOT be extended with per-module entries again; it SHALL continue to check only cookie presence, never validity (spec §4.1).
- SHALL NOT describe `/app/*` as security-enforced by the frontend anywhere in code comments or UI copy — `AuthGuard`/`@Roles()` remain the only authoritative layers (spec §4.1).
- `DataTable`'s existing `{ columns, rows, rowKey, emptyMessage }` contract SHALL keep compiling unchanged for its 5 existing call sites (`admin`, `customers`, `cleaners`, `catalog`, `catalog/add-ons` list pages — spec §4.4's "`admin`, `customers`, `cleaners`, `catalog` list pages" names 4 modules, one of which has 2 physical files); all new props SHALL be optional (spec §4.4).
- Interactive `DataTable` rows (`onRowClick` provided) SHALL be keyboard-reachable and Enter/Space-activatable (spec §4.4, §4.6).
- `Modal` and `DetailDrawer` SHALL both use `role="dialog"`, `aria-modal="true"`, `aria-labelledby`; SHALL trap focus while open and restore it on close; SHALL close on Escape (spec §4.4, §4.6).
- The `logout` mutation SHALL be the only new GraphQL operation; SHALL be resolved in `modules/admins/presentation/graphql/admin.resolver.ts` alongside `login`; SHALL require no guard/role and SHALL be idempotent for an invalid or missing session (spec §4.3).
- A successful `logout` SHALL clear the Apollo cache and `router.replace('/login')`; a failed `logout` SHALL NOT navigate and SHALL NOT clear the cache (spec §4.3).
- `DetailDrawer`'s close action SHALL return to the list URL with `detail` removed regardless of how the drawer was entered — the exact mechanism is this plan's decision (§6, Task 5) per the spec's explicit deferral (spec §4.4).
- SHALL NOT introduce new domain entities, new RBAC roles, new audit events, server-side pagination, Operations Dashboard content, or any Booking/Job/Quality code (spec §2, §7).
- SHALL NOT add a browser-automation test suite for `apps/web` (spec §7, Phase 1 Design §7).

## 2. Ownership boundaries

| Area | Owns | Notes |
| --- | --- | --- |
| `apps/api/src/modules/admins/presentation/graphql/admin.resolver.ts` | `logout` mutation (Task 1) | Only file changed in `apps/api` for this milestone. |
| `packages/client/src/operations/logout.graphql`, `packages/client/src/generated/graphql.ts` | `logout` operation document + regenerated hook (Task 1) | Mechanical codegen output, not hand-edited. |
| `packages/ui/src/*` | All primitives (Tasks 2–4) | Content-agnostic only — no domain imports, no `apps/web` imports. |
| `apps/web/components/app-shell/*` | `Sidebar`, `Header`, `UserMenu`, `AppShell` (Task 5) | Composition, not primitives — stays in `apps/web` per spec §5 boundary rule. |
| `apps/web/lib/use-sidebar-collapsed.ts`, `apps/web/lib/use-detail-drawer.ts` | Shared hooks (Tasks 5–6) | `apps/web`-local; not `packages/ui` (they're Next.js-specific, not domain-agnostic UI). |
| `apps/web/app/app/**` | The new route tree (Tasks 5–8) | One `layout.tsx` (shell), one subtree per migrated module. |
| `apps/web/middleware.ts`, `apps/web/next.config.ts`, `apps/web/app/login/page.tsx` | Routing infrastructure (Task 5 for matcher/login redirect; each migration task appends its own `next.config.ts` redirect entries) | |

**Must remain untouched:** every other `apps/api` module and GraphQL operation; RBAC (`platform/auth`); `platform/audit`; any Booking/Job/Quality code (none exists yet); the existing `DataTable`'s current four props (only additive changes); `packages/client`'s other generated operations.

**Old page files are deleted, not kept.** Each migration task (5–8) deletes the old top-level page files (e.g. `apps/web/app/customers/**`) in the same commit that adds their `/app/app/**` replacement — Next.js `redirects()` in `next.config.ts` take precedence over filesystem routes, so nothing requires keeping the old files around, and leaving them would create two parallel, silently-diverging implementations of the same screen.

## 3. Contract inventory

Authorized by the Accepted spec only — nothing here is new:

- **New GraphQL operation:** `logout: Boolean!` (spec §4.3).
- **New/extended `packages/ui` exports:** `Modal`, `PageHeader`, `ToastProvider`/`useToast`, `LoadingState`, `EmptyState`, `ErrorState`, `FormDialog`, `ConfirmDialog`, `DetailDrawer`, extended `DataTable` (spec §4.4) — exact prop interfaces are defined in the spec and restated only where a task needs to reference specific prop names; this plan does not redefine them.
- **Route table:** the full old→new mapping in spec §4.1, executed incrementally per migration task (§6 below).
- **Explicitly deferred (not built here):** a canonical `/app/customers/[id]` route (spec §5), server-side pagination (spec §7), an `/app/admins` or `/app/staff` rename (spec §4.2), a "log out anyway" fallback (spec §4.3, §7).

## 4. Slice sequence

```text
Task 1 (logout mutation, API + codegen)
   │
   ├──> Task 2 (Modal, PageHeader, feedback primitives)
   │        │
   │        v
   │    Task 3 (FormDialog, ConfirmDialog, DetailDrawer — compose Modal)
   │
   └──> Task 4 (DataTable extension — independent of Tasks 2–3)
            │
   Tasks 1–4 all feed:
            v
       Task 5 (App shell + routing infra + Admin migration — first, simplest, no drawer)
            │
            v
       Task 6 (Customers migration — first DetailDrawer proof)
            │
            v
       Task 7 (Cleaners & Teams migration)
            │
            v
       Task 8 (Catalog migration: Services + Add-ons)
            │
            v
       Task 9 (Golden-path verification — spec §6, no new code expected)
```

Hard prerequisites: Task 3 needs `Modal` from Task 2. Task 5 needs the `logout` hook (Task 1), `ToastProvider` (Task 2), `FormDialog` (Task 3, for the Admin create form), and `DataTable` (Task 4). Tasks 6–8 additionally need `DetailDrawer` (Task 3) and the shell (Task 5). Task 9 needs everything.

## 5. TDD / verification strategy

**Task 1 (`apps/api`)** gets real automated tests, per this repo's established pattern for `modules/admins`: a resolver unit test (guard/role metadata, matching `admin.resolver.spec.ts`'s existing `describe.each` style) plus an e2e test extending `apps/api/test/admin-foundation.e2e-spec.ts` that asserts the `Set-Cookie` header on `logout`'s response actually expires the cookie, and that calling `logout` with no cookie present is idempotent (returns `true`, does not throw). It does **not** test JWT revocation — the existing token scheme is stateless with no server-side blacklist, and the spec's own claim is only "the cookie is cleared and the call is idempotent," not "a captured token becomes unusable." Inventing a revocation test would assert behavior the spec never authorized.

**Tasks 2–4 (`packages/ui`)** have no test runner configured in this package (`packages/ui/package.json`'s `build` script is `tsc --noEmit` only, and no test file exists anywhere under `packages/ui` or `apps/web` today). Verification is: (a) the new/extended components type-check against the exact prop interfaces the Accepted spec §4.4 defines, via `tsc --noEmit`; (b) interactive behavior (focus trap, Escape, ARIA roles, keyboard row activation) is verified manually once a real consumer exists — deferred to Tasks 5–8, not skipped, since these primitives have no visual surface on their own until something renders them.

**Tasks 5–8 (`apps/web`)** have no automated test suite in this milestone (spec §7, Phase 1 Design §7 — both explicit non-goals). Each task's own section below states a short manual verification checklist scoped to what that task changed. Task 9 runs the full golden path spec §6 specifies word-for-word, as the final, consolidated manual proof.

## 6. Task breakdown

### Task 1: `logout` mutation

**Files:**
- Modify: `apps/api/src/modules/admins/presentation/graphql/admin.resolver.ts`
- Test: `apps/api/src/modules/admins/tests/graphql/admin.resolver.spec.ts`
- Test: `apps/api/test/admin-foundation.e2e-spec.ts`
- Create: `packages/client/src/operations/logout.graphql`
- Regenerate: `packages/client/src/generated/graphql.ts` (via `pnpm --filter @clensy/client codegen`, or the repo's equivalent codegen script)

**Interfaces:**
- Produces: `logout(): Boolean!` GraphQL mutation, no arguments, no guard. Produces `useLogoutMutation()` in `@clensy/client` for Task 5 to consume.
- Consumes: `SESSION_COOKIE_NAME` from `apps/api/src/platform/auth/auth.constants.ts` (existing).

- [ ] **Step 1: Add the resolver unit test first** (RED — `logout` doesn't exist yet), extending the existing `describe.each` guard/role table in `admin.resolver.spec.ts`:

```ts
describe('logout', () => {
  it('has neither AuthGuard nor @Roles() — callable without a session', () => {
    expect(guardsOn('logout')).toEqual([]);
    expect(rolesOn('logout')).toBeUndefined();
  });
});
```

(Add `'logout'` to the `ResolverMethod` union at the top of the file.)

- [ ] **Step 2: Add the e2e test** in `admin-foundation.e2e-spec.ts` (also RED), following the file's existing `Set-Cookie`-capture convention:

```ts
it('logout expires the session cookie and is idempotent without one', async () => {
  const loginResponse = await request(app.getHttpServer())
    .post('/graphql')
    .send({ query: LOGIN_MUTATION, variables: { loginInput: SEED_OWNER_CREDENTIALS } });
  const loginCookie = extractSetCookie(loginResponse); // existing helper in this file

  const logoutResponse = await request(app.getHttpServer())
    .post('/graphql')
    .set('Cookie', loginCookie)
    .send({ query: 'mutation { logout }' });

  expect(logoutResponse.body.data.logout).toBe(true);
  const clearedCookie = logoutResponse.headers['set-cookie']?.[0];
  expect(clearedCookie).toBeDefined();
  expect(clearedCookie).toMatch(/clensy_admin_session=;/); // cleared value
  expect(clearedCookie).toMatch(/Expires=Thu, 01 Jan 1970/i); // clearCookie's expiry

  // idempotent: no cookie at all still succeeds
  const noCookieResponse = await request(app.getHttpServer())
    .post('/graphql')
    .send({ query: 'mutation { logout }' });
  expect(noCookieResponse.body.data.logout).toBe(true);
});
```

Adjust `LOGIN_MUTATION`/`SEED_OWNER_CREDENTIALS`/`extractSetCookie` to whatever names this file's existing login test already uses — do not invent parallel helpers.

- [ ] **Step 3: Run both tests, confirm they fail** (no `logout` field/method exists yet):

Run: `pnpm --filter api test -- admin.resolver.spec.ts` and `pnpm --filter api test:e2e -- admin-foundation.e2e-spec.ts`
Expected: both FAIL — the unit test on an undefined `logout` method, the e2e test on a GraphQL "Cannot query field 'logout'" error.

- [ ] **Step 4: Implement the `logout` resolver method**, mirroring `login`'s cookie-handling structure exactly (spec §4.3 — idempotent, unauthenticated-safe). Do not hand-copy `setSessionCookie`'s `httpOnly`/`secure`/`sameSite`/`path` values as independent literals — a browser only clears a cookie when `clearCookie`'s options match the ones it was set with, so a second, separately-typed copy is exactly the kind of drift risk that later silently breaks logout if `setSessionCookie` ever changes. Extract those four shared attributes (everything except `maxAge`, which only `setSessionCookie` needs) into one constant both methods read from:

```ts
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
};

// existing method — refactor its inline options object to spread the
// shared constant instead of repeating the four literals, adding only
// the `maxAge` this method alone needs:
private setSessionCookie(res: Response, token: string): void {
  const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '8h');
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: ms(expiresIn as Parameters<typeof ms>[0]),
  });
}

@Mutation(() => Boolean)
async logout(@Context() context: GqlContext): Promise<boolean> {
  this.clearSessionCookie(context.res);
  return true;
}

private clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS);
}
```

This does touch `setSessionCookie`'s existing body — a small, behavior-preserving refactor (its runtime options are identical before and after), not a new decision about what the attributes should be.

- [ ] **Step 5: Re-run both tests, confirm they pass.**

Run: `pnpm --filter api test -- admin.resolver.spec.ts` and `pnpm --filter api test:e2e -- admin-foundation.e2e-spec.ts`
Expected: both PASS.

- [ ] **Step 6: Add `packages/client/src/operations/logout.graphql`**:

```graphql
mutation Logout {
  logout
}
```

- [ ] **Step 7: Regenerate `packages/client/src/generated/graphql.ts`** and confirm `useLogoutMutation` is exported.

- [ ] **Step 8: Commit.**

```bash
git add apps/api/src/modules/admins/presentation/graphql/admin.resolver.ts \
        apps/api/src/modules/admins/tests/graphql/admin.resolver.spec.ts \
        apps/api/test/admin-foundation.e2e-spec.ts \
        packages/client/src/operations/logout.graphql \
        packages/client/src/generated/graphql.ts
git commit -m "feat(admins): add logout mutation"
```

---

### Task 2: `packages/ui` — `Modal`, `PageHeader`, feedback primitives

**Files:**
- Create: `packages/ui/src/internal/use-dialog-behavior.ts` (not exported from `index.ts` — internal to the package)
- Create: `packages/ui/src/modal.tsx`
- Create: `packages/ui/src/page-header.tsx`
- Create: `packages/ui/src/toast.tsx` (`ToastProvider`, `useToast`)
- Create: `packages/ui/src/loading-state.tsx`
- Create: `packages/ui/src/empty-state.tsx`
- Create: `packages/ui/src/error-state.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Produces: `Modal({ open, onClose, title, children })`, `PageHeaderProps` exactly as spec §4.4, `ToastProvider`/`useToast()` (`success(message)`/`error(message)` methods, minimal), `LoadingState`, `EmptyState({ message, action? })`, `ErrorState({ message, onRetry? })`. Also produces the internal `useDialogBehavior` hook (not part of the package's public surface) that Task 3's `DetailDrawer` consumes directly — see that task's note on why `DetailDrawer` doesn't compose the public `Modal` component.
- Consumes: nothing outside `packages/ui` and React.

- [ ] **Step 1: Implement `useDialogBehavior`** — the shared accessibility mechanics every modal-like primitive in this package needs, factored out so `Modal` and `DetailDrawer` (Task 3) each get it without either depending on the other's public component contract:

```ts
// packages/ui/src/internal/use-dialog-behavior.ts
'use client';
import { useEffect, useRef } from 'react';

export function useDialogBehavior(open: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (open) triggerRef.current = document.activeElement;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        // cycle Tab/Shift+Tab within containerRef's focusable descendants;
        // if none exist, keep focus on the container itself.
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    const trigger = triggerRef.current;
    if (trigger && trigger.isConnected) (trigger as HTMLElement).focus?.();
  }, [open]);

  function backdropProps() {
    return {
      onClick: (event: React.MouseEvent) => {
        if (event.target === event.currentTarget) onClose();
      },
    };
  }

  return { containerRef, backdropProps };
}
```

This is the **only** place focus-trap/Escape/backdrop-click logic lives — neither `Modal` nor `DetailDrawer` reimplements it. It has no opinion on backdrop dimming or positioning; those stay in each component's own markup/Tailwind classes, which is exactly where the two are supposed to visually differ.

- [ ] **Step 2: Implement `Modal`** using `useDialogBehavior`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at a generated title id, centered layout, dimmed (`bg-black/50` or similar) backdrop via `backdropProps()`.

- [ ] **Step 3: Implement `PageHeader`** — a simple `title`/`description?`/`actions?` layout, no logic.

- [ ] **Step 4: Implement `ToastProvider`/`useToast`** — a React context holding a list of `{ id, tone: 'success' | 'error', message }`, auto-dismissed after a few seconds, rendered as a fixed-position stack.

- [ ] **Step 5: Implement `LoadingState`, `EmptyState`, `ErrorState`** — small presentational components (spinner/message, message + optional action slot, message + optional retry button respectively), matching this package's existing visual style (see `packages/ui/src/data-table.tsx`'s Tailwind classes for the established look).

- [ ] **Step 6: Export the public primitives introduced by this task from `packages/ui/src/index.ts`** — `Modal`, `PageHeader`, `ToastProvider`, `useToast`, `LoadingState`, `EmptyState`, `ErrorState` (the last six are components; `useToast` is a hook, not a component, but is exported alongside them the same way) — following the existing `export { X } from './x'; export type { XProps } from './x';` pattern. **Do not export `useDialogBehavior`** — it stays internal to the package.

- [ ] **Step 7: Type-check.**

Run: `pnpm --filter @clensy/ui build`
Expected: no errors.

- [ ] **Step 8: Commit.**

```bash
git add packages/ui/src/internal/use-dialog-behavior.ts \
        packages/ui/src/modal.tsx packages/ui/src/page-header.tsx packages/ui/src/toast.tsx \
        packages/ui/src/loading-state.tsx packages/ui/src/empty-state.tsx packages/ui/src/error-state.tsx \
        packages/ui/src/index.ts
git commit -m "feat(ui): add Modal, PageHeader, and feedback primitives"
```

---

### Task 3: `packages/ui` — `FormDialog`, `ConfirmDialog`, `DetailDrawer`

**Files:**
- Create: `packages/ui/src/form-dialog.tsx`
- Create: `packages/ui/src/confirm-dialog.tsx`
- Create: `packages/ui/src/detail-drawer.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: the public `Modal` component from Task 2 for `FormDialog`/`ConfirmDialog` (both want exactly `Modal`'s centered, dimmed-backdrop behavior — no new capability needed from it). Consumes the **internal** `useDialogBehavior` hook from Task 2 directly for `DetailDrawer` — `DetailDrawer` does **not** compose the public `Modal` component, since `Modal`'s public contract (`{ open, onClose, title, children }`) has no prop for a right-side layout or a non-dimmed backdrop, and adding one would be a new, spec-unauthorized public surface. Sharing the same internal hook gives both the identical accessibility behavior without either duplicating it or reaching into the other's implementation.
- Produces: `FormDialogProps`, `ConfirmDialogProps`, `DetailDrawer` props — exactly as spec §4.4.

- [ ] **Step 1: Implement `FormDialog`** composing `Modal`: renders a `<form onSubmit={...}>` wrapping `children`, calling the spec's `onSubmit` on the form's native submit event; owns the Cancel button and a submit button disabled while `submitting`.

- [ ] **Step 2: Implement `ConfirmDialog`** composing `Modal`: renders `description`, owns Cancel and a `confirmLabel` button that calls `onConfirm` and is disabled (alongside Cancel) while `confirming`.

- [ ] **Step 3: Implement `DetailDrawer`** using `useDialogBehavior` directly (not the public `Modal` component — see this task's Interfaces note): `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, slides in from the right at `widthClassName` (default within 360–480px), backdrop rendered via the hook's `backdropProps()` but styled transparent/non-dimming instead of `Modal`'s dimmed backdrop — the only visual difference between the two, while the underlying focus-trap/Escape/backdrop-click mechanics are identical because both call the same hook. No `aria-hidden`/`inert` on a wrapper around the rest of the page — the shared hook's focus trap plus its click-catching backdrop already stop every form of interaction from reaching the background; adding `aria-hidden` on top would target a different problem (hiding content from assistive tech) and risks hiding content a screen reader user still needs. Closes via `onClose`, same as `Modal`.

  **Note:** `DetailDrawer` itself does not decide *how* `onClose` updates the URL — that's the caller's job (see Task 5's `useDetailDrawer` hook). `DetailDrawer` only calls `onClose()`; it holds no routing knowledge.

- [ ] **Step 4: Export all three from `packages/ui/src/index.ts`.**

- [ ] **Step 5: Type-check.**

Run: `pnpm --filter @clensy/ui build`

- [ ] **Step 6: Commit.**

```bash
git add packages/ui/src/form-dialog.tsx packages/ui/src/confirm-dialog.tsx packages/ui/src/detail-drawer.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add FormDialog, ConfirmDialog, DetailDrawer"
```

---

### Task 4: `packages/ui` — extend `DataTable`

**Files:**
- Modify: `packages/ui/src/data-table.tsx`

**Interfaces:**
- Produces: the extended `DataTableProps<T>` exactly as spec §4.4 (`loading?`, `error?`, `onRowClick?`, `pagination?` added; existing four props unchanged).
- Consumes: `LoadingState`, `ErrorState` from Task 2 for the internal loading/error rendering.

- [ ] **Step 1: Add the new optional props** to `DataTableColumn`/`DataTableProps` exactly as spec §4.4's interface block, plus the new `DataTablePaginationProps` interface.

- [ ] **Step 2: Render `loading`/`error` states** before the existing empty/rows branching: `loading` renders `<LoadingState />` in place of the table body; `error` renders `<ErrorState message={error} />`; both take precedence over the existing `emptyMessage` branch.

- [ ] **Step 3: Make rows keyboard-accessible when `onRowClick` is provided** — per spec §4.4/§4.6: add `role="button"`, `tabIndex={0}`, an `onClick` calling `onRowClick(row)`, and a `keydown` handler that calls the same on `Enter`/`Space` (with `event.preventDefault()` on Space to stop page scroll).

- [ ] **Step 4: Render `pagination` when provided** — a simple prev/next + page-count control below the table body, calling `onPageChange`. Omit entirely when `pagination` is undefined.

- [ ] **Step 5: Confirm all 5 existing call sites still compile unchanged** (`apps/web/app/admin/page.tsx`, `apps/web/app/customers/page.tsx`, `apps/web/app/cleaners/page.tsx`, `apps/web/app/catalog/page.tsx`, and `apps/web/app/catalog/add-ons/page.tsx` — none of them pass the new props, so none of their call sites should need edits at all).

Run: `pnpm --filter web build` (or `tsc --noEmit` scoped to `apps/web`) — expect no new errors introduced by the `DataTable` change.

- [ ] **Step 6: Commit.**

```bash
git add packages/ui/src/data-table.tsx
git commit -m "feat(ui): extend DataTable with loading, error, row-click, and pagination"
```

---

### Task 5: App shell, routing infrastructure, and Admin migration

This is the first task to touch `apps/web/app/app/**` and is deliberately built against Admin — the simplest of the four route areas (no `DetailDrawer` needed) — so the shell has a real, working consumer from its first commit rather than a stub page.

**Files:**
- Create: `apps/web/lib/use-sidebar-collapsed.ts`
- Create: `apps/web/components/app-shell/sidebar.tsx`
- Create: `apps/web/components/app-shell/header.tsx`
- Create: `apps/web/components/app-shell/user-menu.tsx`
- Create: `apps/web/components/app-shell/app-shell.tsx`
- Create: `apps/web/app/app/layout.tsx`
- Create: `apps/web/app/app/page.tsx`
- Create: `apps/web/app/app/admin/page.tsx`
- Delete: `apps/web/app/admin/page.tsx` (content moves into the new location)
- Modify: `apps/web/middleware.ts`
- Modify: `apps/web/app/login/page.tsx`
- Modify: `apps/web/next.config.ts`

**Interfaces:**
- Consumes: `useLogoutMutation` (Task 1), `Modal`/`ToastProvider`/`useToast`/`PageHeader` (Task 2), `FormDialog` (Task 3), extended `DataTable` (Task 4), existing `useCurrentAdminQuery` (`@clensy/client`, already used by the old `admin/page.tsx`).
- Produces: `AppShell` (used by every subsequent migration task's `layout.tsx` — there is only one `layout.tsx` at `apps/web/app/app/layout.tsx`, so Tasks 6–8 do not create new layout files, only new page files under it).

- [ ] **Step 0: Verify the route tree** this task's redirects and Tasks 6–8's redirects will depend on, against spec §4.1's table exactly (spec §6 requires the redirect map be "exhaustive against every route that exists in `apps/web/app` today"):

Run: `find apps/web/app -type f \( -name 'page.tsx' -o -name 'page.ts' \) | sort` — a directory alone isn't a Next.js route, only a `page.*` file inside it is, so this is the authoritative check, not a directory listing. Map each result to its route and confirm the set matches spec §4.1's table exactly: `/admin`, `/catalog`, `/catalog/[id]`, `/catalog/add-ons`, `/catalog/add-ons/[id]`, `/cleaners`, `/cleaners/[id]`, `/cleaners/teams`, `/cleaners/teams/[id]`, `/customers`, `/customers/[id]`, `/login`. If the tree has drifted since the spec was written, stop and return to M2/M3 rather than silently adjusting the redirect map here.

- [ ] **Step 1: `use-sidebar-collapsed.ts`** — the localStorage-backed collapse state (spec §4.2, key `clensy.sidebar.collapsed`):

```ts
'use client';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'clensy.sidebar.collapsed';

export function useSidebarCollapsed(): [boolean, (value: boolean) => void] {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) setCollapsed(stored === 'true');
  }, []);

  function update(value: boolean) {
    setCollapsed(value);
    window.localStorage.setItem(STORAGE_KEY, String(value));
  }

  return [collapsed, update];
}
```

- [ ] **Step 2: `sidebar.tsx`** — grouped nav per spec §4.2: PEOPLE (Customers → `/app/customers`, Cleaners → `/app/cleaners`, Teams → `/app/cleaners/teams`), CATALOG (Services → `/app/catalog`, Add-ons → `/app/catalog/add-ons`), ADMINISTRATION (Staff → `/app/admin`). Active-link highlight via `usePathname()` leading-segment match.

  Two independent presentations, not one component doing both:
  - **Desktop** (`md:` breakpoint and above): uses `useSidebarCollapsed`; renders as an icon rail when collapsed, full labels when expanded; the collapse toggle button lives in the sidebar itself.
  - **Below `md:`**: the sidebar renders as a fixed-position off-canvas drawer, hidden by default (`translate-x-full` or unmounted), opened by a toggle button `Header` renders in its mobile view (Step 3) via a shared `mobileNavOpen` boolean state lifted into `AppShell` (Step 5) and passed down to both `Sidebar` and `Header`. A `useEffect` watching `usePathname()` closes it (`setMobileNavOpen(false)`) on every route change, satisfying spec §4.2's "closes automatically after a navigation."

- [ ] **Step 3: `header.tsx`** — renders its `children` (a mobile nav-toggle button, visible only below `md:`, calling the `onMobileNavToggle` prop `AppShell` passes down) plus mounts `UserMenu`. `Header` does **not** render `PageHeader` — see Step 6's note on why that's a separate, page-level concern, not a header-owned slot.

- [ ] **Step 4: `user-menu.tsx`** — calls `useCurrentAdminQuery` for identity/role display; **Log out** action implements the exact success/failure flow from spec §4.3. Spec §4.3 says the failure message is "an inline message **on the user menu**," not a toast — `ToastProvider`/`useToast` (Task 2) is not used here at all; the message is local component state rendered directly in this menu:

```ts
'use client';
import { useApolloClient } from '@apollo/client';
import { useLogoutMutation, useCurrentAdminQuery } from '@clensy/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function UserMenu() {
  const apolloClient = useApolloClient();
  const router = useRouter();
  const { data } = useCurrentAdminQuery();
  const [logout, { loading }] = useLogoutMutation();
  const [logoutError, setLogoutError] = useState<string | undefined>(undefined);

  async function handleLogout() {
    setLogoutError(undefined);
    try {
      const result = await logout();
      if (!result.data?.logout) throw new Error('logout returned false');
      await apolloClient.clearStore();
      router.replace('/login');
    } catch {
      setLogoutError('Unable to log out. Please try again.');
    }
  }

  // ...identity display + "Log out" button calling handleLogout, disabled while
  // `loading`; render `logoutError` as text inside this menu when set, e.g.
  // directly beneath the Log out button, not via the toast system.
}
```

- [ ] **Step 5: `app-shell.tsx`** — composes `Sidebar` + `Header` + a content slot; owns the `mobileNavOpen` boolean state (`useState`) and passes it plus its setter down to both `Sidebar` (to render/hide the drawer) and `Header` (to render the toggle button and close it after a click, in addition to `Sidebar`'s own route-change effect from Step 2); wraps everything in `ToastProvider` (mounted once, here, for every `/app/*` page).

- [ ] **Step 6: `apps/web/app/app/layout.tsx`** — renders `AppShell`, passing `children` through to its content slot. This is the **only** layout file for the entire `/app/*` tree — Tasks 6–8 add pages under it, not new layouts.

  **`PageHeader` placement:** spec §4.2 describes it as living in "the header," but a Next.js layout's `children` slot has no natural mechanism for a child page to inject content into a *different* part of its parent layout (`Header`) without a context/slot abstraction this milestone doesn't need. This plan resolves it visually instead: each migrated page (Tasks 5 Step 8, 6, 7, 8) renders its own `<PageHeader>` as the first element of its own page content, immediately above its `DataTable` — visually it reads as "the page's header," even though structurally it's inside `{children}`, not inside the persistent `Header` component. `Header` (Step 3) owns only the user menu and the mobile nav toggle. This is a plan-level implementation decision, not a spec-level behavior change — the visual outcome (title near the top of every page, user menu always visible) is unchanged.

- [ ] **Step 7: `apps/web/app/app/page.tsx`** — the `/app` redirect. **Temporarily** targets `/app/admin` in this task, since Admin is the only module Task 5 migrates — Task 6 changes this same file's destination to `/app/customers` once Customers exists, matching the spec's final `/app` → `/app/customers` default (spec §4.1). This keeps `/app` never pointing at a route that doesn't exist yet on `main` at any commit:

```ts
import { redirect } from 'next/navigation';

export default function AppIndexPage() {
  redirect('/app/admin'); // Task 6 changes this to '/app/customers'
}
```

- [ ] **Step 8: `apps/web/app/app/admin/page.tsx`** — port the existing `admin/page.tsx` content: same `useCurrentAdminQuery` auth/owner check, same `useAdminsQuery`/`useCreateAdminMutation`/`useDisableAdminMutation` logic, but the create form moves from an inline `<section>` into a `FormDialog` opened from a `PageHeader`'s `actions` slot ("+ New Staff Account" `Button`), and the list uses the now-extended `DataTable` (no `pagination` — this list has none today). No `DetailDrawer` — Admin has no detail view (spec §4.7).

  **Wire the existing "Disable" action through `ConfirmDialog`.** Today's `admin/page.tsx` calls `handleDisable(row.id)` directly from the row's "Disable" button with no confirmation at all. Spec §4.5 establishes "Confirm a destructive action → `ConfirmDialog`" as the normative rule "for this and future milestones, so nothing reinvents its own interaction model" — disabling a staff account is exactly that kind of action, and it's already being touched by this migration. Route it through `ConfirmDialog` (title "Disable this staff account?", description naming the account, `confirmLabel` "Disable", `onConfirm` calling the existing `handleDisable`). This is the only consumer of `ConfirmDialog` in this milestone — none of the other three migrated modules (Customers, Cleaners/Teams, Catalog) have an existing destructive action to wire it to, and this plan does not invent one for them.

- [ ] **Step 9: Delete `apps/web/app/admin/page.tsx`.**

- [ ] **Step 10: `middleware.ts`** — replace the four-entry matcher array with the single pattern:

```ts
export const config = {
  matcher: ['/app/:path*'],
};
```

(The `middleware` function body — cookie-presence check, redirect to `/login` — is unchanged.)

- [ ] **Step 11: `apps/web/app/login/page.tsx`** — change the success redirect from `router.push('/admin')` to `router.push('/app')` (spec §4.8).

- [ ] **Step 12: `next.config.ts`** — add the Admin redirect (the only one this task is responsible for). **Each of Tasks 6–8 appends its own module's entries to this same `redirects()` array — never replaces it.** Before committing, re-read the full array and confirm every entry added by an earlier task is still present:

```ts
async redirects() {
  return [
    { source: '/admin', destination: '/app/admin', permanent: true },
  ];
}
```

- [ ] **Step 13: Manual verification** (no automated test suite — §5): log in → land on `/app` → redirected to `/app/admin` → sidebar renders all groups, collapse toggle persists across a reload → below the `md:` breakpoint, sidebar becomes a hidden drawer, opens via the header toggle, closes automatically on navigating to another link → visit `/app/admin` directly → staff list renders via `DataTable` → "+ New Staff Account" opens `FormDialog`, create succeeds, list refreshes → "Disable" on an active row opens `ConfirmDialog` before actually disabling; confirming disables it, canceling leaves it active → old `/admin` URL redirects to `/app/admin` → user menu shows identity/role → **Log out** clears the session and lands on `/login`; disconnect network and retry logout to confirm the failure path shows the inline error and does not navigate.

- [ ] **Step 14: Commit.**

```bash
git add apps/web/lib/use-sidebar-collapsed.ts apps/web/components/app-shell/ \
        apps/web/app/app/layout.tsx apps/web/app/app/page.tsx apps/web/app/app/admin/page.tsx \
        apps/web/middleware.ts apps/web/app/login/page.tsx apps/web/next.config.ts
git rm apps/web/app/admin/page.tsx
git commit -m "feat(web): app shell, /app/* routing infrastructure, and Admin migration"
```

---

### Task 6: Customers migration

First task to introduce `DetailDrawer` — the proof point spec §6's golden path names explicitly.

**Files:**
- Create: `apps/web/lib/use-detail-drawer.ts`
- Create: `apps/web/app/app/customers/page.tsx`
- Delete: `apps/web/app/customers/page.tsx`, `apps/web/app/customers/[id]/page.tsx`
- Modify: `apps/web/next.config.ts`
- Modify: `apps/web/app/app/page.tsx` (redirect target: `/app/admin` → `/app/customers`, finalizing spec §4.1's default now that Customers exists)

**Interfaces:**
- Produces: `useDetailDrawer(paramName?: string)` — reused by Tasks 7 and 8, not reimplemented per module.
- Consumes: `DetailDrawer`, `FormDialog` (Task 3), `PageHeader`, `useToast` (Task 2), extended `DataTable` (Task 4), `AppShell`/layout (Task 5, already mounted — this task adds only a page, no new layout).

- [ ] **Step 1: `use-detail-drawer.ts`** — implements the same-page-origin-flag mechanism spec §4.4 requires but deliberately left as a plan-level decision:

```ts
'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef } from 'react';

export function useDetailDrawer(paramName = 'detail') {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openedHereRef = useRef(false);

  const activeId = searchParams.get(paramName);

  const open = useCallback((id: string) => {
    openedHereRef.current = true;
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, id);
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams, paramName]);

  const close = useCallback(() => {
    if (openedHereRef.current) {
      openedHereRef.current = false;
      router.back();
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete(paramName);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [router, pathname, searchParams, paramName]);

  return { activeId, open, close };
}
```

- [ ] **Step 2: `apps/web/app/app/customers/page.tsx`** — port the existing `customers/page.tsx` list/create logic: `useCustomersQuery`/`useCreateCustomerMutation` unchanged; render a `PageHeader` (title "Customers", `actions` holding the "+ New Customer" trigger — see Task 5 Step 6's note: this page owns its own `PageHeader`, `Header` does not); inline create form moves into a `FormDialog`; list uses extended `DataTable` with `onRowClick` calling `useDetailDrawer().open(row.id)`; when `activeId` is set, render `DetailDrawer` with the customer's detail fields — port `customers/[id]/page.tsx`'s edit-form content (its `useUpdateCustomerMutation` logic) as the drawer's `children`, calling `useToast().success(...)` on save (new — the old full page had no toast) and `close()` on the drawer's `onClose`.

- [ ] **Step 3: Delete `apps/web/app/customers/page.tsx` and `apps/web/app/customers/[id]/page.tsx`.**

- [ ] **Step 4: `next.config.ts`** — append (do not remove Task 5's `/admin` entry):

```ts
{ source: '/customers', destination: '/app/customers', permanent: true },
{ source: '/customers/:id', destination: '/app/customers?detail=:id', permanent: true },
```

- [ ] **Step 5: `apps/web/app/app/page.tsx`** — change the redirect target from `/app/admin` (Task 5's temporary value) to `/app/customers`, the spec's actual final default (spec §4.1).

- [ ] **Step 6: Manual verification:** `/app` now lands on `/app/customers` → create a customer via `FormDialog` → appears in `DataTable` → click row → `DetailDrawer` opens, URL shows `?detail=<id>` → edit and save → success toast → close via `X` → URL returns to `/app/customers` with no `detail` param → repeat close via browser Back after opening by row click, confirm it also returns cleanly → visit `/app/customers?detail=<id>` directly (simulating a shared link) → drawer opens correctly → close it → confirm it lands on the plain list URL, not somewhere outside the app → old `/customers/[id]` URL redirects to `/app/customers?detail=[id]` → if any old customer URL is ever visited with an extra query string (e.g. `/customers/123?ref=email`), confirm Next.js's redirect either preserves it or drops it predictably — note the actual observed behavior in the task report; this plan does not assume one or the other.

- [ ] **Step 7: Commit.**

```bash
git add apps/web/lib/use-detail-drawer.ts apps/web/app/app/customers/page.tsx apps/web/app/app/page.tsx apps/web/next.config.ts
git rm apps/web/app/customers/page.tsx
git rm -r apps/web/app/customers/\[id\]
git commit -m "feat(web): migrate Customers to /app/customers with DetailDrawer"
```

---

### Task 7: Cleaners & Teams migration

**Files:**
- Create: `apps/web/app/app/cleaners/page.tsx`, `apps/web/app/app/cleaners/teams/page.tsx`
- Delete: `apps/web/app/cleaners/page.tsx`, `apps/web/app/cleaners/[id]/page.tsx`, `apps/web/app/cleaners/teams/page.tsx`, `apps/web/app/cleaners/teams/[id]/page.tsx`
- Modify: `apps/web/next.config.ts`

**Interfaces:**
- Consumes: `useDetailDrawer` (Task 6), `DetailDrawer`/`FormDialog` (Task 3), extended `DataTable` (Task 4).

- [ ] **Step 1: `apps/web/app/app/cleaners/page.tsx`** — same porting pattern as Task 6 Step 2, applied to the existing `cleaners/page.tsx` + `cleaners/[id]/page.tsx` content.

- [ ] **Step 2: `apps/web/app/app/cleaners/teams/page.tsx`** — same pattern, applied to `cleaners/teams/page.tsx` + `cleaners/teams/[id]/page.tsx`. Uses its own `useDetailDrawer()` call (each list page owns its own `detail` param independently — there is no cross-page drawer state).

- [ ] **Step 3: Delete the four old files.**

- [ ] **Step 4: `next.config.ts`** — append (do not remove any entry Tasks 5–6 already added):

```ts
{ source: '/cleaners', destination: '/app/cleaners', permanent: true },
{ source: '/cleaners/:id', destination: '/app/cleaners?detail=:id', permanent: true },
{ source: '/cleaners/teams', destination: '/app/cleaners/teams', permanent: true },
{ source: '/cleaners/teams/:id', destination: '/app/cleaners/teams?detail=:id', permanent: true },
```

- [ ] **Step 5: Manual verification** — same checklist shape as Task 6 Step 6, run against both `/app/cleaners` and `/app/cleaners/teams` independently.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/app/app/cleaners/ apps/web/next.config.ts
git rm apps/web/app/cleaners/page.tsx
git rm -r apps/web/app/cleaners/\[id\]
git rm apps/web/app/cleaners/teams/page.tsx
git rm -r apps/web/app/cleaners/teams/\[id\]
git commit -m "feat(web): migrate Cleaners & Teams to /app/cleaners with DetailDrawer"
```

---

### Task 8: Catalog migration (Services + Add-ons)

**Files:**
- Create: `apps/web/app/app/catalog/page.tsx`, `apps/web/app/app/catalog/add-ons/page.tsx`
- Delete: `apps/web/app/catalog/page.tsx`, `apps/web/app/catalog/[id]/page.tsx`, `apps/web/app/catalog/add-ons/page.tsx`, `apps/web/app/catalog/add-ons/[id]/page.tsx`
- Modify: `apps/web/next.config.ts`

**Interfaces:**
- Consumes: `useDetailDrawer` (Task 6), `DetailDrawer`/`FormDialog` (Task 3), extended `DataTable` (Task 4). Reuses the existing `toEditableAmount`/`parsePesosToMinorUnits` helpers from `apps/web/app/catalog/format-price.ts` unchanged — this migration does not touch money formatting.

- [ ] **Step 1: `apps/web/app/app/catalog/page.tsx`** — port `catalog/page.tsx` + `catalog/[id]/page.tsx`, same pattern as Task 6.

- [ ] **Step 2: `apps/web/app/app/catalog/add-ons/page.tsx`** — port `catalog/add-ons/page.tsx` + `catalog/add-ons/[id]/page.tsx`. Note the current add-ons detail page has no standalone `addOn(id)` query (it filters `useAddOnsQuery()`'s full list client-side, per that file's existing comment) — preserve that same approach; this plan does not add a new query.

- [ ] **Step 3: `apps/web/lib/format-price.ts`** — if `format-price.ts` currently lives under `apps/web/app/catalog/`, move it to `apps/web/lib/format-price.ts` so it isn't nested inside a route segment that no longer exists at that path; update its two import sites accordingly. (Skip this step if the file already lives outside `app/catalog/`.)

- [ ] **Step 4: Delete the four old files** (and the old `format-price.ts` location if moved).

- [ ] **Step 5: `next.config.ts`** — append (do not remove any entry Tasks 5–7 already added):

```ts
{ source: '/catalog', destination: '/app/catalog', permanent: true },
{ source: '/catalog/:id', destination: '/app/catalog?detail=:id', permanent: true },
{ source: '/catalog/add-ons', destination: '/app/catalog/add-ons', permanent: true },
{ source: '/catalog/add-ons/:id', destination: '/app/catalog/add-ons?detail=:id', permanent: true },
```

- [ ] **Step 6: Manual verification** — same checklist shape as Task 6 Step 6, run against both `/app/catalog` and `/app/catalog/add-ons`; additionally confirm price entry/display still round-trips correctly through `DetailDrawer` (money formatting is unchanged, but the surrounding container is new).

- [ ] **Step 7: Commit.** `apps/web/lib/format-price.ts` is only in this file list if Step 3 actually moved it — omit that path if `format-price.ts` already lived outside `app/catalog/` and Step 3 was skipped.

```bash
git add apps/web/app/app/catalog/ apps/web/lib/format-price.ts apps/web/next.config.ts
git rm apps/web/app/catalog/page.tsx
git rm -r apps/web/app/catalog/\[id\]
git rm apps/web/app/catalog/add-ons/page.tsx
git rm -r apps/web/app/catalog/add-ons/\[id\]
git commit -m "feat(web): migrate Catalog (Services, Add-ons) to /app/catalog with DetailDrawer"
```

---

### Task 9: Golden-path verification

No new code is expected from this task — it exists to run spec §6's exact acceptance script end-to-end and fix anything it surfaces. If it surfaces a real gap, fix it here as a small, targeted change (not a redesign); if it surfaces a spec ambiguity, stop and return to M2/M3 rather than inventing an answer.

**Files:** none expected; any fix is a small change to a file already touched by Tasks 1–8.

- [ ] **Step 1: Run the exact golden path from spec §6:**

```text
Log in → land on /app (redirects to /app/customers) → create a customer via
FormDialog → see it in the DataTable → click the row → DetailDrawer opens
with ?detail= in the URL → edit and see a success toast → close the drawer
(via Back) → log out → land on /login
```

- [ ] **Step 2: Verify every old-path redirect** from spec §4.1's table resolves correctly, including nested ones (`/cleaners/teams/[id]`, `/catalog/add-ons/[id]`).

- [ ] **Step 3: Verify responsive behavior** — collapse the viewport to a tablet/mobile width; confirm the sidebar becomes a drawer, opens via the header toggle, and closes after a navigation (spec §4.2).

- [ ] **Step 4: Verify accessibility invariants** from spec §4.6 on at least one `Modal`-based dialog and the `DetailDrawer`: Escape closes each, focus is trapped while open, focus returns to the triggering element on close, and a `DataTable` row is reachable and activatable via keyboard alone.

- [ ] **Step 5: Commit** only if Steps 1–4 surfaced a fix; otherwise this task closes with no commit.

## 7. Public surfaces requiring implementation

- `packages/ui`: `Modal`, `PageHeader`, `ToastProvider`/`useToast`, `LoadingState`, `EmptyState`, `ErrorState`, `FormDialog`, `ConfirmDialog`, `DetailDrawer`, extended `DataTable` — prop shapes are fixed by the Accepted spec §4.4; this plan does not add or freeze anything beyond it.
- `packages/client`: `useLogoutMutation` (generated, not hand-authored).
- `apps/web`: `useSidebarCollapsed`, `useDetailDrawer` — plan-level implementation decisions (§6, Tasks 5 and 6), not spec-level contracts; a later milestone may change their internals freely as long as the behavioral requirement (spec §4.4) still holds.

## 8. Self-check

- Every task traces to an Accepted-spec section (cited in each task's Interfaces/Steps): ✓.
- No task introduces product semantics beyond spec §4 — the two hooks in Tasks 5–6 implement a spec-mandated *requirement* (§4.4's deferred "safest mechanism" decision), not new behavior. ✓
- Task ordering is executable without inventing missing work — each migration task's prerequisites (shell, primitives) are fully built by an earlier task. ✓
- Deferred work is explicit: canonical `/app/customers/[id]`, server-side pagination, `/app/admins` rename, "log out anyway" — all named in §3 and traceable to spec §5/§7. ✓
- No missing design semantics were discovered while writing this plan; nothing here required returning to M2/M3.

## 9. Non-goals

- Redesigning or amending the Accepted specification.
- Plan Review decisions (M5) — this plan does not self-Accept.
- Any implementation activity beyond what M6 will execute from this plan.
- Booking, Job, Quality, or Operations Dashboard work.
- A browser-automation test suite for `apps/web`.
- Server-side pagination for any migrated list.
- Renaming `/app/admin`.
