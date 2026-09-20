# Reusable-Component `errorMessage` API — Design

| Field | Value |
| --- | --- |
| Status | Draft |
| Date | 2026-09-20 |
| Tracking issue | [#63](https://github.com/rexescario-dev/clensy-platform/issues/63) — "Normalize component errorMessage API and default translations" |
| Depends on (Accepted) | [Reusable `DataTable` and `BookingDataTable`](2026-09-19-reusable-data-table-design.md) — established `BookingDataTable`'s current `error?: string` prop (this spec renames it, constrains) and, through its implementation, `@clensy/web`'s own i18n context (`ClensyI18nProvider`/`useClensyTranslations`/the per-namespace default-messages catalog) that this spec extends with a new `auth` namespace and a new `bookings.error` key (extends). [`@clensy/web` / `LoginForm`](2026-09-19-clensy-web-login-form-design.md) — established `LoginForm`'s current contract: `errorMessage: string` required, `labels` fully caller-supplied, no `@clensy/web` i18n-context usage. This spec constrains that contract (`errorMessage` becomes optional with a package-owned default) while leaving `labels` exactly as that spec defined it (relies upon, §2). [App Router i18n Architecture (next-intl)](2026-09-13-web-i18n-architecture-design.md) — established `apps/web/messages/en/auth.json` and the "`apps/web` translates, components take strings as props" boundary this spec's `apps/web`-side change (deleting `errors.invalidCredentials`) operates within (relies upon). |
| Related (not a dependency) | [`@clensy/ui` as the Shared UI System](2026-09-16-shadcn-ui-boundary-design.md) — its "components take already-translated strings as props; only `apps/web` (or now `@clensy/web`) resolves translations" rule is why this spec's project-wide sweep (§4.5) leaves every `@clensy/ui` `error`/`message` prop untouched: those primitives are business-agnostic and structurally cannot own a translated default. |
| Followed by | None required. Any future `@clensy/web` domain component that displays a component-level error should adopt `errorMessage?: string` plus a package-owned translated default from the start, following the pattern this spec establishes (§4.2–§4.3) rather than reinventing it. |
| Governing references | This document. It does not redesign `@clensy/ui`'s `ErrorState`/`DataTable`/`FormField`/`Toast`/`LoadingState`/`EmptyState` `error`/`message` props, `LoginForm`'s `labels` prop or validation behavior, `BookingDataTable`'s columns or rendering, or the `@clensy/web` i18n context's merge/fallback mechanics — it revises exactly one property name and its default-resolution behavior on each of the two existing `@clensy/web` domain components, adds one new occurrence-signal prop to `BookingDataTable` only (§4.3, §6), and removes the now-redundant defaults their `apps/web` callers used to supply. |

## 1. Thesis

`LoginForm` and `BookingDataTable` — the two existing `@clensy/web` domain components — each display a single generic error string, but disagree on how: `LoginForm`'s `errorMessage: string` is required, with `apps/web/app/login/page.tsx` supplying the only copy of its default text (`"Invalid email or password."`) via next-intl; `BookingDataTable`'s `error?: string` is optional but has no default at all, so `apps/web/app/app/bookings/page.tsx` supplies a hardcoded (non-translated) fallback (`"Unable to load bookings."`) inline. Neither component can be used without its host either supplying a string every time (`LoginForm`) or accepting a blank error state (`BookingDataTable`). This spec makes `errorMessage?: string` the one property name both components use for error *text*, moves each component's existing default English copy (unchanged wording) into a package-owned translated default resolved through `@clensy/web`'s own i18n context (the same `ClensyI18nProvider`/`useClensyTranslations`/default-messages-catalog mechanism `BookingDataTable` already uses for its column headers), and removes the now-redundant default-supplying code from both `apps/web` call sites. Because `BookingDataTable`'s error *occurrence* — unlike `LoginForm`'s — is decided by its host rather than internally, `BookingDataTable` also gains one small, explicit occurrence signal (`hasError?: boolean`) so that "no error" and "error, use the default" remain distinguishable once `errorMessage` always has a default to fall back to (§6). A project-wide sweep (§4.5) confirms these are the only two components this normalization applies to.

## 2. Scope

**In scope (normative):**

- `LoginForm`: `errorMessage` becomes `errorMessage?: string` (was `errorMessage: string`). The existing `setError(errorMessage)` call (in `onValid`'s `catch`) becomes `setError(errorMessage ?? t('error'))`, where `t` comes from a new `useClensyTranslations('auth')` call — `LoginForm`'s first use of the `@clensy/web` i18n context. No other line in `LoginForm` changes (§4.2).
- A new `auth` namespace in `@clensy/web`'s default-messages catalog (`packages/web/src/i18n/messages/en/auth.ts`), registered in `getDefaultMessages()`: `{ error: 'Invalid email or password.' }` — the exact existing wording, relocated, not reworded (§4.2).
- `BookingDataTable`: `error?: string` is renamed to `errorMessage?: string`, and a new `hasError?: boolean` (default `false`) is added as the error-occurrence signal (§6). Internally, `const resolvedErrorMessage = hasError ? (errorMessage ?? t('error')) : undefined;` (using the `t` from its existing `useClensyTranslations('bookings')` call) is passed to the underlying `@clensy/ui` `DataTable`'s existing `error` prop, which is **not** renamed (§4.3).
- A new `error: 'Unable to load bookings.'` key added to the existing `bookings` namespace in `packages/web/src/i18n/messages/en/bookings.ts` — the exact existing wording, relocated, not reworded (§4.3).
- `apps/web/app/login/page.tsx`: remove the `errorMessage={t('errors.invalidCredentials')}` line from its `<LoginForm ... />` call entirely — no replacement prop.
- `apps/web/messages/en/auth.json`: delete the now-unused `errors.invalidCredentials` key (and its now-empty `errors` object).
- `apps/web/app/app/bookings/page.tsx`: replace `error={error ? 'Unable to load bookings.' : undefined}` with `hasError={Boolean(error)}` on its `<BookingDataTable ... />` call — no `errorMessage` prop passed (the page has no custom wording to supply; `BookingDataTable`'s default covers it) (§4.4).
- Tests: extend `booking-data-table.test.tsx` for the rename, the new `hasError` prop, and the new default-vs-override behavior; add `login-form.test.tsx` (new file — `LoginForm` has no test file today) for the same default-vs-override behavior (§8).

**Informative:** the full project-wide sweep confirming `LoginForm` and `BookingDataTable` are the only two `@clensy/web` (or otherwise caller-facing, non-`@clensy/ui`) components with an error-display prop today (§4.5).

**Out of scope:**

- Every `@clensy/ui` `error`/`message` prop (`ErrorState.message`, `DataTable.error`, `FormField.error`, `Toast.message`, `LoadingState.message`, `EmptyState.message`). These are business-agnostic `base/` primitives that take already-translated strings as props by existing, Accepted architecture (Related, above) — they have no mechanism to own a translated default and this spec does not give them one. `DataTable.error` specifically stays named `error`, receiving `BookingDataTable`'s already-resolved `resolvedErrorMessage` (§4.3).
- `LoginForm`'s `labels` prop and its migration into the `@clensy/web` i18n catalog. `labels` stays a required, fully caller-supplied prop exactly as the LoginForm spec defined it — this ticket does not turn into a `labels` migration (§2, Depends on).
- Any change to `LoginForm`'s validation rules, submission flow, or accessibility attributes; any change to `BookingDataTable`'s columns, formatting, or pagination behavior.
- Any change to `apps/api`, or to *when* an error is considered to have occurred (`onLogin` rejecting for `LoginForm`; the bookings page's existing `useBookingsQuery` `error` value for `BookingDataTable`) — this spec changes only what string is displayed and, for `BookingDataTable` only, adds the explicit prop that already-existing occurrence information is passed through (§6).
- Introducing a second locale, `locale`/`messages` override props on either component, or a structured (object/union) `errorMessage` — explicit issue constraints.
- Any `apps/web/components/layout/*` component or other non-`@clensy/web` reusable component — the sweep (§4.5) found none with an equivalent error-display API.

## 3. Terminology

- **Component-owned default:** a translated string a `@clensy/web` component resolves itself, via `useClensyTranslations`, when its host supplies no override — the same mechanism `BookingDataTable` already uses for column headers, now extended to error text for both components.
- **Override:** a truthy `errorMessage` value a host explicitly passes, always used in place of the component-owned default when an error is occurring. Passing `errorMessage={undefined}` (or omitting the prop) is not an override — both mean "use the default text," identically.
- **Occurrence signal:** the separate, boolean piece of information that tells a component *whether* to display an error at all, distinct from *what* text to show. `LoginForm` derives this internally (a rejected `onLogin` promise); `BookingDataTable` takes it explicitly as `hasError` because its host, not the component itself, knows whether the underlying data fetch failed (§6).
- **Resolved error message:** the final string a component actually displays or forwards, after applying its occurrence signal and `errorMessage ?? t('error')`. `BookingDataTable`'s resolved error message is what reaches `@clensy/ui`'s `DataTable.error` prop, which itself performs no resolution of its own (§4.3).

## 4. Architecture & behavioral contracts

### 4.1 Current state (verified by reading each file)

| Component | Prop(s) today | Default today | Default owned by |
| --- | --- | --- | --- |
| `LoginForm` (`packages/web/src/auth/login-form.tsx`) | `errorMessage: string` (required) | `"Invalid email or password."` | `apps/web/app/login/page.tsx`, via `t('errors.invalidCredentials')` (next-intl) |
| `BookingDataTable` (`packages/web/src/bookings/booking-data-table.tsx`) | `error?: string` (optional, no fallback; doubles as both occurrence signal and text) | `"Unable to load bookings."` | `apps/web/app/app/bookings/page.tsx`, hardcoded inline (not translated) |

Both defaults' exact wording is preserved verbatim by this spec — only where each lives, how each is named, and (for `BookingDataTable` only) how occurrence is signaled, change.

### 4.2 `LoginForm` (`packages/web/src/auth/login-form.tsx`)

```ts
export interface LoginFormProps {
  labels: LoginFormLabels;      // unchanged
  errorMessage?: string;        // was: errorMessage: string
  onLogin: (values: LoginFormValues) => Promise<void>;
}
```

```ts
import { useClensyTranslations } from '../i18n/use-clensy-translations';
// ...
export function LoginForm({ labels, errorMessage, onLogin }: LoginFormProps) {
  const t = useClensyTranslations('auth');
  // ...unchanged state/form setup...
  async function onValid(values: LoginFormValues) {
    setError(undefined);
    setSubmitting(true);
    try {
      await onLogin(values);
    } catch {
      setError(errorMessage ?? t('error'));   // was: setError(errorMessage)
    } finally {
      setSubmitting(false);
    }
  }
  // ...unchanged JSX...
}
```

`LoginForm` needs no occurrence signal beyond what it already has: its `catch` block is itself the occurrence event, exactly as today — only the value passed to `setError` changes. `useClensyI18nContext()` (consumed by `useClensyTranslations`) already falls back to `getDefaultMessages()` when no `ClensyI18nProvider` is present in the tree (established by the i18n-context mechanism `BookingDataTable` relies on) — so `LoginForm` resolves its default correctly whether or not its host wraps it in a Provider, exactly like `BookingDataTable` today. `apps/web/app/login/page.tsx` is not required to add a `ClensyI18nProvider` by this spec (none is added — §2 lists only the one-line removal).

New default-messages file:

```ts
// packages/web/src/i18n/messages/en/auth.ts
export const auth = { error: 'Invalid email or password.' };
```

registered in `packages/web/src/i18n/messages.ts`:

```ts
import { auth } from './messages/en/auth';
import { bookings } from './messages/en/bookings';

export function getDefaultMessages() {
  return { auth, bookings };
}
```

The namespace is `auth` (matching `packages/web/src/auth/`'s directory name, the same convention `bookings` already follows for `packages/web/src/bookings/`) — not `loginForm` or any other component-specific name, since a namespace names the domain area, not the one component that happens to consume it today (matching `bookings`, which is likewise consumed by exactly one component today).

### 4.3 `BookingDataTable` (`packages/web/src/bookings/booking-data-table.tsx`)

```ts
export interface BookingDataTableProps {
  bookings: Booking[];
  formatPrice: (minorUnits: number) => string;
  loading?: boolean;
  hasError?: boolean;       // new — occurrence signal, default false
  errorMessage?: string;    // was: error?: string — text only, never implies occurrence
  onRowClick?: (booking: Booking) => void;
  pagination: DataTablePaginationProps;
}

export function BookingDataTable({
  bookings,
  formatPrice,
  loading,
  hasError,
  errorMessage,
  onRowClick,
  pagination,
}: BookingDataTableProps) {
  const t = useClensyTranslations('bookings');   // unchanged call, same namespace
  const resolvedErrorMessage = hasError ? (errorMessage ?? t('error')) : undefined;
  // ...unchanged columns...
  return (
    <DataTable
      columns={columns}
      rows={bookings}
      rowKey={(row) => row.id}
      emptyMessage={t('empty')}
      loading={loading}
      error={resolvedErrorMessage}   // DataTable's own prop name is unchanged
      onRowClick={onRowClick}
      pagination={pagination}
    />
  );
}
```

Semantics (§6 has the full rationale for why `hasError` exists):

| `hasError` | `errorMessage` | Result passed to `DataTable.error` |
| --- | --- | --- |
| `false` / omitted | (any) | `undefined` — no error state, regardless of `errorMessage` |
| `true` | omitted | `t('error')` → `"Unable to load bookings."` |
| `true` | supplied | the supplied string |

`@clensy/ui`'s `DataTable` renders its error branch whenever its `error` prop is truthy, taking priority over `loading` and the empty/row-list branches (`packages/ui/src/base/data-table.tsx`, confirmed by reading its render logic — not assumed from the prop name). Because `resolvedErrorMessage` is `undefined` whenever `hasError` is falsy, `DataTable`'s error branch renders only when `BookingDataTable`'s host explicitly signals an error — matching today's behavior exactly for the one existing caller (§4.4).

New key in the existing `bookings` namespace:

```ts
// packages/web/src/i18n/messages/en/bookings.ts
export const bookings = {
  columns: { /* unchanged */ },
  empty: 'No bookings.',
  error: 'Unable to load bookings.',   // new
  unassigned: 'Unassigned',
};
```

### 4.4 `apps/web` callers

```tsx
// apps/web/app/login/page.tsx — before
<LoginForm
  labels={{ /* ... */ }}
  errorMessage={t('errors.invalidCredentials')}
  onLogin={handleLogin}
/>
// after
<LoginForm
  labels={{ /* ... */ }}
  onLogin={handleLogin}
/>
```

```tsx
// apps/web/app/app/bookings/page.tsx — before
<BookingDataTable
  bookings={rows}
  formatPrice={formatMinorUnits}
  loading={loading}
  error={error ? 'Unable to load bookings.' : undefined}
  onRowClick={(booking) => openDetail(booking.id)}
  pagination={{ /* ... */ }}
/>
// after
<BookingDataTable
  bookings={rows}
  formatPrice={formatMinorUnits}
  loading={loading}
  hasError={Boolean(error)}
  onRowClick={(booking) => openDetail(booking.id)}
  pagination={{ /* ... */ }}
/>
```

The bookings page's `error` value (from `useBookingsQuery`) is unchanged in origin and meaning — it still means exactly "the query failed." What changes is how that fact reaches `BookingDataTable`: as a boolean occurrence signal (`hasError`) instead of as a hand-authored English string standing in for that boolean. `apps/web/messages/en/auth.json`'s `errors.invalidCredentials` key is deleted — it existed solely to supply `LoginForm`'s now-package-owned default, and nothing else reads it (verified by grep, §4.5).

### 4.5 Project-wide sweep (verified by grep across `packages/ui/src`, `packages/web/src`, `apps/web`)

Every `error`/`errorMessage`/`message: string` (optional or required) property found:

| File | Property | In scope? |
| --- | --- | --- |
| `packages/ui/src/base/error-state.tsx` | `message: string` | No — `@clensy/ui` primitive (§2) |
| `packages/ui/src/base/data-table.tsx` | `error?: string` | No — `@clensy/ui` primitive; receives `BookingDataTable`'s resolved string unchanged (§4.3) |
| `packages/ui/src/base/form-field.tsx` | `error?: string` | No — `@clensy/ui` primitive (§2) |
| `packages/ui/src/base/toast.tsx` | `message: string` | No — `@clensy/ui` primitive (§2) |
| `packages/ui/src/base/loading-state.tsx` | `message?: string` | No — `@clensy/ui` primitive (§2) |
| `packages/ui/src/base/empty-state.tsx` | `message: string` | No — `@clensy/ui` primitive (§2) |
| `packages/web/src/auth/login-form.tsx` | `errorMessage: string` | **Yes** (§4.2) |
| `packages/web/src/bookings/booking-data-table.tsx` | `error?: string` | **Yes** (§4.3) |

No other `@clensy/web` component exists today (`packages/web/src` contains only `auth/`, `bookings/`, and `i18n/`). No `apps/web/components/*` file declares an error-display prop of this shape. This confirms the issue's "inspect other reusable components" instruction finds exactly the two components it already names — no additional normalization target exists.

## 5. Rationale

**Why `errorMessage` and not `error`?** The issue fixes this name explicitly; `errorMessage` also reads unambiguously as "a string to display," where a bare `error` name invites confusion with error *objects* (e.g. Apollo's `ApolloError`, already present as a same-named local variable on the bookings page) — a confusion the issue explicitly warns against introducing (`error` variables/objects are not in scope, §2).

**Why does `DataTable.error` keep its own name instead of also becoming `errorMessage`?** `DataTable` is a generic, business-agnostic `@clensy/ui` primitive with no default-ownership concept — renaming it would suggest it participates in the same default-resolution contract `BookingDataTable` now has, which it structurally cannot (it has no i18n context, by design). Keeping `DataTable.error` distinct from `BookingDataTable.errorMessage` keeps the boundary between "generic presentational prop" and "domain component's own contract" visible at the type level, not just by convention.

**Why extend the existing `@clensy/web` i18n context instead of a simpler local default (e.g., a plain exported constant)?** The issue is explicit: defaults must come "through the existing `@clensy/web` i18n architecture," not a parallel mechanism. `BookingDataTable` already proves the pattern works with zero required application-level integration (context gracefully falls back with no Provider); extending the same mechanism to `LoginForm` costs one new namespace file and one `useClensyTranslations` call, and keeps exactly one i18n mechanism in `@clensy/web`, as the issue also requires ("Do not introduce ... a second i18n mechanism").

## 6. Design decision: `BookingDataTable`'s `hasError` occurrence signal

Making `errorMessage` optional-with-a-default changes what "omitted" means for a component that owns a default: an omitted `errorMessage` must now resolve to a *truthy default string*, per the issue's own override table ("errorMessage omitted → use component's translated default message"). For `LoginForm` this is unambiguous, because the component itself decides *when* an error is occurring (its own `catch` block) — `errorMessage` only ever matters at that one internal moment. `BookingDataTable` has no equivalent internal signal: today, its single `error?: string` prop conflates *whether* an error occurred with *what* to show, and its host (the bookings page) supplies a truthy string exactly when, and only when, its `useBookingsQuery` failed. If `BookingDataTable` resolved `errorMessage ?? t('error')` unconditionally, the result would be truthy on every render — including when nothing has gone wrong — because a package-owned default is, by definition, always available. That would make `DataTable`'s error branch (which renders whenever `error` is truthy) fire permanently, a regression the issue's "existing booking behavior is unchanged" acceptance criterion explicitly forbids.

Two ways to resolve this were considered:

1. **`hasError?: boolean` occurrence signal (adopted):** `errorMessage` becomes text-only, never implying occurrence. A separate, explicit `hasError` prop (default `false`) tells `BookingDataTable` whether to resolve and display anything at all; `errorMessage` is resolved and forwarded to `DataTable.error` only when `hasError` is `true` (§4.3's table). The bookings page passes `hasError={Boolean(error)}`, expressing exactly the same "did the query fail" fact it already computes — as a boolean, not as a hand-authored string standing in for one.
2. **Keep `error` as the occurrence signal, add `errorMessage` as override-only:** `BookingDataTable` would keep a truthy-string-means-error prop (renamed or not) and add a second, purely-optional `errorMessage` used only when the first is truthy. Rejected: it keeps two properties where the issue's canonical-single-prop framing (`errorMessage?: string` as "the" reusable-component error-message prop) argues for one text prop, and it would still require the host to synthesize an arbitrary truthy value it doesn't otherwise need — the same string-standing-in-for-a-boolean problem this spec is trying to remove, only shifted to a differently-named prop.

Option 1 is adopted: it keeps exactly one text prop (`errorMessage`, matching the issue's canonical name), keeps `BookingDataTable` able to own a real translated default (satisfying the issue's explicit "`BookingDataTable` has a translated default error message" acceptance criterion), and lets the bookings page satisfy the issue's other explicit criterion ("Booking page does not pass a redundant default error message") by passing a boolean instead of English text. `LoginForm` needs no equivalent prop, for the reason stated above: its occurrence signal is already fully internal and never host-supplied.

## 7. Followed-by

None. This is a complete, self-contained normalization; Governing references (header) states explicitly that no further `@clensy/web` component work is implied.

## 8. Testing and acceptance

Consistent with this repository's existing precedent (`vitest` + `renderToStaticMarkup`, no `jsdom`/`@testing-library/react`, per `booking-data-table.test.tsx`):

**`packages/web/src/auth/login-form.test.tsx` (new file):**
- Omitting `errorMessage` and causing `onLogin` to reject renders `"Invalid email or password."` (the package default, resolved via the real `@clensy/web` i18n fallback — no mocking of `useClensyTranslations`).
- Supplying `errorMessage` and causing `onLogin` to reject renders the supplied string instead.

**`packages/web/src/bookings/booking-data-table.test.tsx` (extended):**
- Existing tests updated for the `error` → `errorMessage`/`hasError` rename where they touch that prop (verify at M4/M6 against the file's exact current test list — none of the four existing tests shown in §4.1's source currently exercise the error branch, so this may be additive-only).
- `hasError` omitted (or `false`) with `errorMessage` supplied: `DataTable`'s error branch does not render — proving `errorMessage` alone never implies occurrence (§6).
- `hasError={true}` with `errorMessage` omitted: renders `"Unable to load bookings."`.
- `hasError={true}` with `errorMessage` supplied: renders the supplied string instead.

**Grep-verifiable acceptance gates:**
- No remaining reference to `apps/web/messages/en/auth.json`'s `errors.invalidCredentials` anywhere in `apps/web`.
- `BookingDataTable`'s public props are `hasError`/`errorMessage`, not `error`, in both its interface and its one `apps/web` call site.
- `DataTable.error` (the `@clensy/ui` primitive prop) is unrenamed.

**Build gates:** `pnpm --filter @clensy/web build`/`lint`/`test` and `pnpm --filter web build`/`lint`/`test` succeed.

**Manual golden path:** login with valid credentials still succeeds and redirects; login with invalid credentials still shows the same message it does today; the Bookings page's error state (e.g., simulated query failure) still shows the same message it does today; both pages' happy paths (successful login, successful bookings load) are unaffected, with no error state rendering when nothing has failed.

## 9. Non-goals

- Any `@clensy/ui` primitive's `error`/`message` prop (§2, §4.5).
- `LoginForm`'s `labels` prop or its migration into the `@clensy/web` i18n catalog (§2).
- A second locale, `locale`/`messages` override props, or a structured `errorMessage` (§2 — explicit issue constraints).
- Any change to *when* either component's underlying error condition occurs, only what string is shown and (for `BookingDataTable`) how occurrence is signaled (§2, §6).
- A `CustomerDataTable` or any other new domain component (unrelated to this ticket).

## 10. Acceptance criteria (for this specification)

- States both components' exact current contracts and default-ownership locations, verified by reading each file, not assumed from the issue's description (§4.1).
- Specifies `LoginForm`'s exact new contract and default-resolution point precisely enough that M4 does not need to invent it (§4.2).
- Specifies `BookingDataTable`'s exact new contract, including the new `hasError` prop's full truth table and which underlying `@clensy/ui` prop name does and does not change (§4.3).
- Identifies and resolves, with rationale, the gap between "an optional prop with a component-owned default" and "a way to know whether to show anything at all" — a design decision the issue's illustrative examples don't cover, since `LoginForm`'s occurrence is internal while `BookingDataTable`'s is host-driven (§6).
- Documents a project-wide sweep with its exact results (table, §4.5), closing the issue's "inspect other reusable components" instruction with evidence rather than assertion.
- States precisely what apps/web-side code and translation keys are removed, and why each is genuinely dead rather than assumed dead (§4.4).
- Defines a testing and acceptance bar consistent with this repository's existing precedent, including tests that specifically prove `hasError` prevents the always-truthy default from firing when no error has occurred (§8).
