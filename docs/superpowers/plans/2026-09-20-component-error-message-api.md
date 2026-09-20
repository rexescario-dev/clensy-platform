# Reusable-Component `errorMessage` API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize `LoginForm` and `BookingDataTable`'s error-display props to a single `errorMessage?: string` shape, each backed by a package-owned translated default, and remove the now-redundant default text both `apps/web` call sites currently supply.

**Architecture:** A new shared pure helper (`resolveMessage`) centralizes the "supplied override or package default" resolution both components need. `LoginForm` gains a first-time dependency on `@clensy/web`'s existing i18n context (`useClensyTranslations`) for a new `auth` namespace. `BookingDataTable` gains a new `hasError?: boolean` occurrence signal alongside its renamed `errorMessage?: string`, because — unlike `LoginForm`, whose error occurrence is internal (a rejected `onLogin` promise) — `BookingDataTable`'s occurrence is host-driven (a GraphQL query result) and must stay distinguishable from "no error" now that `errorMessage` always resolves to a truthy default. `apps/web`'s two call sites (`login/page.tsx`, `app/bookings/page.tsx`) are thinned to stop supplying English default text.

**Tech Stack:** TypeScript, React 19, `vitest` (+ `renderToStaticMarkup`, no `jsdom`/`@testing-library/react`), pnpm workspaces (`@clensy/web`, `@clensy/ui`, `web`/`apps/web`), `next-intl` (apps/web only), the `@clensy/web` i18n context (`ClensyI18nProvider`/`useClensyTranslations`/`getDefaultMessages`).

**Spec:** [docs/superpowers/specs/2026-09-20-component-error-message-api-design.md](../specs/2026-09-20-component-error-message-api-design.md)

## Global Constraints

- `errorMessage` is the canonical property name on both components (issue #63).
- Default wording is preserved **verbatim**, relocated only: `"Invalid email or password."` (LoginForm), `"Unable to load bookings."` (BookingDataTable).
- No `locale`/`messages` override props, no structured (object/union) `errorMessage`, no second i18n mechanism (spec §2, §9).
- `@clensy/ui`'s `DataTable.error` prop is **not** renamed and gains no new logic — it keeps taking an already-resolved string (spec §2, §5).
- `LoginForm`'s `labels` prop is unchanged — no migration into the i18n catalog (spec §2, §9).
- No `jsdom`/`@testing-library/react`/interaction-simulation is introduced anywhere (spec §8, §9) — every automated test uses `vitest` + `renderToStaticMarkup`, or is a plain non-rendering unit test.
- No unrelated refactoring (issue #63's explicit acceptance criterion).

---

### Task 1: `resolveMessage` shared helper

**Files:**
- Create: `packages/web/src/i18n/resolve-message.ts`
- Test: `packages/web/src/i18n/resolve-message.test.ts`

**Interfaces:**
- Produces: `resolveMessage(override: string | undefined, fallback: string): string` — returns `override ?? fallback`. Consumed by Task 2 (`LoginForm`) and Task 3 (`BookingDataTable`).

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/i18n/resolve-message.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveMessage } from './resolve-message';

describe('resolveMessage', () => {
  it('returns the fallback when override is undefined', () => {
    expect(resolveMessage(undefined, 'default')).toBe('default');
  });

  it('returns the override when supplied', () => {
    expect(resolveMessage('custom', 'default')).toBe('custom');
  });

  it('treats an empty-string override as a valid override, not "use the default"', () => {
    expect(resolveMessage('', 'default')).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @clensy/web test -- resolve-message`
Expected: FAIL — `resolve-message.ts` does not exist yet (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `packages/web/src/i18n/resolve-message.ts`:

```ts
// The one piece of override-vs-default resolution LoginForm and
// BookingDataTable both need. Kept as a pure function so it's testable
// without rendering — neither component's error display is otherwise
// exercisable without interaction simulation, which this repository does
// not use (see login-form's own lack of a test file).
export function resolveMessage(override: string | undefined, fallback: string): string {
  return override ?? fallback;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @clensy/web test -- resolve-message`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/i18n/resolve-message.ts packages/web/src/i18n/resolve-message.test.ts
git commit -m "feat(63): add resolveMessage helper for error-message override/default resolution"
```

---

### Task 2: `LoginForm` — optional `errorMessage` with a package-owned default

**Files:**
- Modify: `packages/web/src/auth/login-form.tsx:21-25` (interface), `:42` (function signature), `:56-58` (catch block)
- Create: `packages/web/src/i18n/messages/en/auth.ts`
- Modify: `packages/web/src/i18n/messages.ts:1-11`

**Interfaces:**
- Consumes: `resolveMessage(override: string | undefined, fallback: string): string` (Task 1); `useClensyTranslations<N extends keyof ClensyMessages>(namespace: N)` (existing, `packages/web/src/i18n/use-clensy-translations.ts`).
- Produces: `LoginFormProps.errorMessage?: string` (was `errorMessage: string`) — consumed by Task 4's `apps/web/app/login/page.tsx` edit. `getDefaultMessages()` now returns `{ auth: { error: string }, bookings: {...} }` — the `auth` namespace is consumed by this task's own `LoginForm` and is available to any future `@clensy/web` `auth/` component.

There is no automated component-level test for this task — see the spec (§8) and this plan's Task 3/5 for why: `LoginForm`'s error display is only reachable by simulating a form submission and an `onLogin` rejection, which `renderToStaticMarkup` (this repository's only rendering-test mechanism) cannot do. This task's correctness is verified by typecheck/lint (Step 2) and the manual golden path in Task 5.

- [ ] **Step 1: Add the `auth` default-messages namespace**

Create `packages/web/src/i18n/messages/en/auth.ts`:

```ts
// Default `en` messages for LoginForm. Mirrors messages/en/bookings.ts's
// own convention: this is the ONLY copy of this text's original English
// wording — relocated from apps/web/messages/en/auth.json's now-deleted
// errors.invalidCredentials key (Task 4), not reworded.
export const auth = {
  error: 'Invalid email or password.',
};
```

Modify `packages/web/src/i18n/messages.ts` — replace the whole file:

```ts
import { auth } from './messages/en/auth';
import { bookings } from './messages/en/bookings';

// Mirrors apps/web/i18n/messages.ts's own getMessages() convention (a flat
// object keyed by namespace, assembled from per-namespace files) — the same
// pattern, applied to @clensy/web's own reusable-component messages rather
// than apps/web's page-level ones. Add a line here per namespace as more
// @clensy/web components need translation.
export function getDefaultMessages() {
  return { auth, bookings };
}

export type ClensyMessages = ReturnType<typeof getDefaultMessages>;
```

- [ ] **Step 2: Update `LoginForm`'s prop type, add the i18n call, and resolve the error message**

In `packages/web/src/auth/login-form.tsx`, add the two new imports after the existing `react-hook-form` import (after line 6):

```ts
import { useClensyTranslations } from '../i18n/use-clensy-translations';
import { resolveMessage } from '../i18n/resolve-message';
```

Change the `LoginFormProps` interface (lines 21-25):

```ts
export interface LoginFormProps {
  labels: LoginFormLabels;
  errorMessage?: string;
  onLogin: (values: LoginFormValues) => Promise<void>;
}
```

Add the translations hook inside `LoginForm` (line 42-43, right after the function signature, before the existing `useState` calls):

```ts
export function LoginForm({ labels, errorMessage, onLogin }: LoginFormProps) {
  const t = useClensyTranslations('auth');
  const [error, setError] = useState<string | undefined>(undefined);
```

Change the `catch` block inside `onValid` (lines 56-58):

```ts
    } catch {
      setError(resolveMessage(errorMessage, t('error')));
    } finally {
```

No other line in `login-form.tsx` changes — validation rules, submit button, JSX, and accessibility attributes are untouched.

- [ ] **Step 3: Verify the package still typechecks and lints**

Run: `pnpm --filter @clensy/web build && pnpm --filter @clensy/web lint`
Expected: both succeed with no errors — in particular, no "possibly undefined" or unused-import errors, and no consumer of `LoginFormProps` elsewhere in `packages/web` breaks (there are none today besides `login-form.tsx` itself).

- [ ] **Step 4: Run the full `@clensy/web` test suite**

Run: `pnpm --filter @clensy/web test`
Expected: PASS — Task 1's `resolve-message.test.ts` and the pre-existing `booking-data-table.test.tsx`/`i18n-context.test.tsx`/`deep-merge.test.ts` all still pass unchanged (this task does not touch `BookingDataTable` or the i18n context internals).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/auth/login-form.tsx packages/web/src/i18n/messages.ts packages/web/src/i18n/messages/en/auth.ts
git commit -m "feat(63): make LoginForm errorMessage optional with a package-owned translated default"
```

---

### Task 3: `BookingDataTable` — `hasError` occurrence signal + renamed `errorMessage`

**Files:**
- Modify: `packages/web/src/bookings/booking-data-table.tsx:1-4` (imports), `:20-27` (interface), `:37-45` (function signature + translations call), `:61-72` (return/`DataTable` call)
- Modify: `packages/web/src/i18n/messages/en/bookings.ts`
- Modify: `packages/web/src/bookings/booking-data-table.test.tsx`

**Interfaces:**
- Consumes: `resolveMessage` (Task 1); `useClensyTranslations('bookings')` (existing, unchanged call).
- Produces: `BookingDataTableProps.hasError?: boolean` (new) and `BookingDataTableProps.errorMessage?: string` (renamed from `error?: string`) — consumed by Task 4's `apps/web/app/app/bookings/page.tsx` edit.

- [ ] **Step 1: Write the failing tests**

In `packages/web/src/bookings/booking-data-table.test.tsx`, add three new `it` blocks inside the existing `describe('BookingDataTable', ...)` block, after the last existing test (after the "applies a partial application override..." test, before the closing `});`):

```ts
  it('renders no error state when hasError is omitted, even if errorMessage is supplied', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[booking]}
        formatPrice={() => '₱0.00'}
        errorMessage="Custom error"
        pagination={pagination}
      />,
    );
    expect(html).not.toContain('Custom error');
    expect(html).toContain('Jane Doe');
  });

  it('renders the package default error message when hasError is true and errorMessage is omitted', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[booking]}
        formatPrice={() => '₱0.00'}
        hasError
        pagination={pagination}
      />,
    );
    expect(html).toContain('Unable to load bookings.');
  });

  it('renders the supplied errorMessage instead of the default when hasError is true', () => {
    const html = renderToStaticMarkup(
      <BookingDataTable
        bookings={[booking]}
        formatPrice={() => '₱0.00'}
        hasError
        errorMessage="Custom error"
        pagination={pagination}
      />,
    );
    expect(html).toContain('Custom error');
    expect(html).not.toContain('Unable to load bookings.');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @clensy/web test -- booking-data-table`
Expected: FAIL — `BookingDataTableProps` has no `hasError`/`errorMessage` members yet (TypeScript compile error under vitest, or the three new assertions fail against the still-`error`-only component, depending on how strict the vitest/tsc integration surfaces it). Confirm the failure is in the three new tests, not the five pre-existing ones.

- [ ] **Step 3: Add the `bookings.error` default message**

Modify `packages/web/src/i18n/messages/en/bookings.ts` — replace the whole file:

```ts
// Default `en` messages for BookingDataTable. This is the ONLY copy of
// these strings' original English text — apps/web is not expected to (and
// today does not) hold a parallel copy; it may layer partial overrides on
// top via ClensyI18nProvider, deep-merged with this catalog.
export const bookings = {
  columns: {
    customer: 'Customer',
    price: 'Price',
    property: 'Property',
    scheduled: 'Scheduled',
    service: 'Service',
    status: 'Status',
    team: 'Team',
  },
  empty: 'No bookings.',
  error: 'Unable to load bookings.',
  unassigned: 'Unassigned',
};
```

- [ ] **Step 4: Update `BookingDataTable`'s prop type and resolution logic**

In `packages/web/src/bookings/booking-data-table.tsx`, add the new import after the existing `useClensyTranslations` import (line 4):

```ts
import { DataTable, type DataTableColumn, type DataTablePaginationProps } from '@clensy/ui';
import { resolveMessage } from '../i18n/resolve-message';
import { useClensyTranslations } from '../i18n/use-clensy-translations';
```

Change the `BookingDataTableProps` interface (lines 20-27):

```ts
export interface BookingDataTableProps {
  bookings: Booking[];
  formatPrice: (minorUnits: number) => string;
  loading?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  onRowClick?: (booking: Booking) => void;
  pagination: DataTablePaginationProps;
}
```

Change the function signature and add the resolution line (lines 37-46):

```ts
export function BookingDataTable({
  bookings,
  formatPrice,
  loading,
  hasError,
  errorMessage,
  onRowClick,
  pagination,
}: BookingDataTableProps) {
  const t = useClensyTranslations('bookings');
  const resolvedErrorMessage = hasError ? resolveMessage(errorMessage, t('error')) : undefined;
```

Change the `DataTable` call's `error` prop (inside the existing `return` block, currently `error={error}` at line 68):

```ts
      error={resolvedErrorMessage}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @clensy/web test -- booking-data-table`
Expected: PASS — all 8 tests (5 pre-existing + 3 new).

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/bookings/booking-data-table.tsx packages/web/src/bookings/booking-data-table.test.tsx packages/web/src/i18n/messages/en/bookings.ts
git commit -m "feat(63): add hasError occurrence signal and rename BookingDataTable's error to errorMessage"
```

---

### Task 4: `apps/web` callers — remove redundant default error text

**Files:**
- Modify: `apps/web/app/login/page.tsx:38`
- Modify: `apps/web/messages/en/auth.json`
- Modify: `apps/web/app/app/bookings/page.tsx:168`

**Interfaces:**
- Consumes: `LoginFormProps.errorMessage?: string` (Task 2); `BookingDataTableProps.hasError?: boolean` (Task 3).

There is no automated test covering either `page.tsx` file today (`apps/web/vitest.config.ts` only includes `lib/**` and `i18n/**`) — this task's verification is typecheck/lint/build plus the manual golden path in Task 5.

- [ ] **Step 1: Remove the redundant `errorMessage` prop from the login page**

In `apps/web/app/login/page.tsx`, delete line 38 (`        errorMessage={t('errors.invalidCredentials')}`) from the `<LoginForm ... />` call, so it reads:

```tsx
      <LoginForm
        labels={{
          email: t('email'),
          password: t('password'),
          submit: t('submit'),
          submitting: t('submitting'),
          title: t('title'),
        }}
        onLogin={handleLogin}
      />
```

- [ ] **Step 2: Delete the now-unused `errors.invalidCredentials` translation key**

Replace `apps/web/messages/en/auth.json` with:

```json
{
  "title": "Clensy Admin Login",
  "email": "Email",
  "password": "Password",
  "submit": "Sign in",
  "submitting": "Signing in…",
  "errors": {}
}
```

Then run `grep -rn "errors\." apps/web --include="*.tsx" --include="*.ts"` to confirm nothing under `apps/web` reads any `errors.*` key from the `auth` namespace. If nothing references `errors` at all after removing `invalidCredentials`, delete the now-empty `"errors": {}` key entirely instead, leaving:

```json
{
  "title": "Clensy Admin Login",
  "email": "Email",
  "password": "Password",
  "submit": "Sign in",
  "submitting": "Signing in…"
}
```

- [ ] **Step 3: Replace the bookings page's hardcoded error string with `hasError`**

In `apps/web/app/app/bookings/page.tsx`, change line 168 from:

```tsx
          error={error ? 'Unable to load bookings.' : undefined}
```

to:

```tsx
          hasError={Boolean(error)}
```

- [ ] **Step 4: Verify `web` typechecks, lints, and builds**

Run: `pnpm --filter web build && pnpm --filter web lint`
Expected: both succeed — in particular, no unused `t` import in `login/page.tsx` if `t` is still used elsewhere on the page (it is: `title`/`email`/`password`/`submit`/`submitting`), and no TypeScript error from `hasError`/`errorMessage` on `BookingDataTable`.

- [ ] **Step 5: Run the `web` test suite**

Run: `pnpm --filter web test`
Expected: PASS — unchanged, since neither edited page is covered by `apps/web/vitest.config.ts`'s current `include`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/login/page.tsx apps/web/messages/en/auth.json apps/web/app/app/bookings/page.tsx
git commit -m "fix(63): stop passing redundant default error text from login and bookings pages"
```

---

### Task 5: Full verification sweep

**Files:** None (verification only).

**Interfaces:** N/A.

- [ ] **Step 1: Run every affected package's full build/lint/test**

Run:

```bash
pnpm --filter @clensy/web build
pnpm --filter @clensy/web lint
pnpm --filter @clensy/web test
pnpm --filter web build
pnpm --filter web lint
pnpm --filter web test
```

Expected: all six succeed.

- [ ] **Step 2: Run the spec's grep-verifiable acceptance gates**

```bash
grep -rn "errors\.invalidCredentials" apps/web --include="*.tsx" --include="*.ts" --include="*.json"
grep -n "error?:" packages/web/src/bookings/booking-data-table.tsx
grep -n "errorMessage?:\|hasError?:" packages/web/src/bookings/booking-data-table.tsx
grep -n "error?:" packages/ui/src/base/data-table.tsx
grep -rn "resolveMessage" packages/web/src
```

Expected: the first command returns nothing; the second returns nothing (no bare `error?:` left on `BookingDataTable`); the third returns both new props; the fourth confirms `DataTable.error` is untouched; the fifth shows `resolveMessage` imported by both `login-form.tsx` and `booking-data-table.tsx` plus its own definition and test.

- [ ] **Step 3: Manual golden path — login**

Start the app (`pnpm --filter web dev`, or use this repository's `run` skill if available) and verify in a browser:
- Logging in with valid credentials still succeeds and redirects to `/app`.
- Logging in with invalid credentials still shows exactly `"Invalid email or password."`.

- [ ] **Step 4: Manual golden path — bookings**

In the same running app:
- The Bookings page (`/app/bookings`) loads and renders rows normally with no error state visible.
- Force a query failure (e.g., temporarily stop the API, or use browser devtools to block the GraphQL request) and confirm the table shows exactly `"Unable to load bookings."`, then restore normal operation and confirm the error clears.

- [ ] **Step 5: Commit (if Step 2's greps required any follow-up fixes)**

Only if Step 2 surfaced something to fix — otherwise this task produces no new changes to commit; Tasks 1-4's commits already cover the full diff.

```bash
git status
```

Expected: clean working tree (nothing beyond what Tasks 1-4 already committed).
