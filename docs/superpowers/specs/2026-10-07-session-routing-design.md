# Consistent `/login` Routing for Missing or Invalid Sessions Across `/app` — Design

| Field | Value |
| --- | --- |
| Status | Accepted. **#146 amendment: Accepted** 2026-10-08. |
| Date | 2026-10-07 (#146 amendment drafted 2026-10-08) |
| Document kind | Architecture RFC |
| Tracking issue | [#131](https://github.com/rexescario-dev/clensy-platform/issues/131) — surfaced by #114 (role-aware typed URLs spec §11 deferral) and its final review. Program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81). Implemented in PR [#145](https://github.com/rexescario-dev/clensy-platform/pull/145). *(#146)* Amendment: [#146](https://github.com/rexescario-dev/clensy-platform/issues/146), the follow-ups to the three non-blocking M7 minors, implemented in PR [#147](https://github.com/rexescario-dev/clensy-platform/pull/147). |
| Depends on (Accepted) | [Admin Foundation](2026-08-14-admin-foundation-design.md) — **relied upon** unchanged: the API is the sole authentication authority, and route middleware MAY use cookie presence only as a UX hint and MUST NOT decode or trust the JWT (§4.8, §6 item 6). [Multi-Tenant Architecture](2026-09-23-multi-tenant-architecture-design.md) — **relied upon** unchanged: navigation and middleware MUST NOT be the security boundary (§5 invariant 13). [Role-Aware Experience for Typed URLs](2026-10-04-role-aware-typed-urls-design.md) (#114) — **constrained**: `PageVisibilityGate`'s contract is unchanged, and this spec takes over the session behavior that #114 left to individual pages (§9). The #114 spec receives a minimal cross-reference amendment under this issue. [Web Shell and Design System](2026-09-10-web-shell-and-design-system-design.md) — **relied upon**: the single `/app` layout. |
| Related (not a dependency) | The #89 shell slice introduced `landingTarget` (`apps/web/lib/landing-target.ts`), which this spec changes (§4.4). The Staff Administration UI (#88) owns `/app/admin`, whose page-local redirect this spec retires (§4.5). |
| Followed by | [#146](https://github.com/rexescario-dev/clensy-platform/issues/146) (amended in place). [#148](https://github.com/rexescario-dev/clensy-platform/issues/148) (PR [#149](https://github.com/rexescario-dev/clensy-platform/pull/149)): code conformance to §4.3 item 1, with no spec change. The `latest` ref is synced in the layout phase. |
| M3 decision | **Accepted** — 2026-10-07, at `0e81e98`, by the owner, on the second pass, with no further changes. M4 implements it mechanically and MUST keep the locked decisions: (1) a subscriber-scoped `UNAUTHENTICATED` signal in `packages/client`; (2) one non-blocking, render-less `SessionGuard` in the `/app` layout, beside `PageVisibilityGate`; (3) a `network-only` `currentAdmin` check on mount and on pathname changes only; (4) only session evidence (§3) redirects; (5) a single-flight `clearStore()` → `replace('/login')`; (6) a latched redirect completes across unmount; (7) no session responsibility in `PageVisibilityGate`; (8) the `/app` and `/app/admin` page-local `/login` redirects retired; (9) no middleware, API, or session-lifetime changes. Boundary: #131 owns session-validity detection and `/login` routing, #114 owns page visibility, and the API remains the authentication and authorization authority. **#146 amendment — Accepted 2026-10-08, at `95157b8`, by the owner, on the first pass, with no changes.** M4 implements it mechanically and MUST keep these: one redirector per mounted guard, never replaced on client or router identity changes, with its effects calling the current client and router; the landing error with `role="alert"` and the admin error's red style, the loading and empty states unchanged; and the literal-based, comment-blind `/login` scan. It hardens three points the #131 M7 review raised as non-blocking. Its delta is confined to the Status, Date, Tracking, Followed-by and M3-decision rows, §4.3 item 1, §4.4, §8 items 2, 3 and 5, and §10. It changes no locked decision. Session evidence, the signal, the check, the single-flight latch, the retirements, invariants 1–13 and acceptance criteria 1–7 are unchanged. |
| M3 history | First pass (2026-10-07, at `5f5192f`): the owner approved the architecture and design direction and returned the spec with nine clarifications. None of them reopens options A/B/C or the signal-plus-check decision. All were applied: (1) a latched redirect runs to completion across unmount (§4.3); (2) the unmount rule covers only new evidence (§4.3, §5 invariant 10); (3) the null and absent `currentAdmin` semantics are defined as deliberately defensive (§3, §4.2); (4) the cold-load example states the single-flight path (§4.7); (5) the error link's placement is not prescribed (§4.1); (6) a multiple-errors notification test is added (§8 item 1); (7) the Apollo deduplication aside is removed (§7); (8) the goal is worded as "when evidence is observed" (§6); (9) the #114 amendment is trimmed to cross-references (§9). |

## 1. Primary question and thesis

**Question:** Where does one consistent "no valid session → `/login`" rule live for every `/app/*` page?

**Thesis:** One client-side **session guard**, mounted once in the `/app` layout as a non-blocking sibling of `PageVisibilityGate`, owns the rule. It acts only on **positive evidence** that the session is invalid. There are two sources of that evidence:

- **Reactive:** any GraphQL operation that returns `extensions.code === 'UNAUTHENTICATED'`. The shared Apollo client reports this through a subscriber-scoped **session signal**.
- **Proactive:** a background `network-only` `currentAdmin` check on every `/app` pathname change. This catches the case where nothing else sends a request, for example a session that expired mid-session followed by navigation to a page the gate denies from the cached principal.

On evidence, the guard performs one redirect: `clearStore()`, then `router.replace('/login')`. The existing `/app` landing and `/app/admin` redirects are folded into it. If session validity can't be determined (a network failure, an HTTP 5xx, any other error), that is **not** evidence. The page keeps its own error UI.

### 1.1 Background (state on `main` at `61b6fb8`)

- `apps/web/middleware.ts` redirects only when the session cookie is **absent**. An expired, invalid, or disabled-account session keeps its cookie and passes through. This is required by Admin Foundation §4.8.
- Only `/app` (through `landingTarget`) and `/app/admin` (through a page-local `useEffect`) send a failed or null `currentAdmin` to `/login`. Both treat **any** `currentAdmin` error as logout, including a network failure.
- Every other page (bookings, jobs, laundry, billing, customers, cleaners, teams, catalog, add-ons) shows its own generic load error, for example "Unable to load teams.", when its queries fail with `UNAUTHENTICATED`.
- `PageVisibilityGate` (#114) evaluates the **cache-first** principal. If the session expires mid-session and the user then opens a page hidden from their role, the gate renders "This page isn't available to you." from the cached principal and no request is sent, so nothing can fail. By the gate's contract it makes no session decision (#114 §4.2, §5 invariant 6).
- The API reports every invalid session (missing cookie, bad or expired signature, unknown or disabled account) as a GraphQL error with `extensions.code: 'UNAUTHENTICATED'`. A role denial is `FORBIDDEN`. Both codes are pinned by the API e2e suites.
- `Query.currentAdmin` is declared non-null and is guarded by `AuthGuard`, so an invalid session surfaces as an `UNAUTHENTICATED` error. A settled null `currentAdmin` with no error is not expected from the API; this spec still treats it as no session (§3), as `landingTarget` and the admin page do today.
- Logout (`user-menu.tsx`) calls `logout()`, then `apolloClient.clearStore()`, then `router.replace('/login')`. `/login` calls `clearStore()` after a successful login before navigating to `/app`.
- This is a UX gap only. The API rejects invalid sessions on every operation.

## 2. Scope

### In scope (normative)

- A session signal in `packages/client`, fed by an Apollo error link on the shared `apolloClient` (§4.1).
- A client component `SessionGuard` in `apps/web/components/layout/session-guard.tsx`, mounted once by `apps/web/app/app/layout.tsx` (§4.2), with its redirect procedure (§4.3).
- Removing the `/login` outcome from `landingTarget`, and a non-session error state for the `/app` landing (§4.4).
- Retiring the page-local `/login` redirect in `apps/web/app/app/admin/page.tsx` (§4.5).
- One new `en` copy key, `nav.landing.error` (§4.6).
- Every `/app/*` page, including the cached-principal case in §1.1.
- A minimal cross-reference amendment of the #114 spec (§9).

### Informative

- Pages other than `/app` and `/app/admin` need no source change. Their `UNAUTHENTICATED` failures reach the guard through the signal, and their other errors keep their current UI.
- Because the proactive check writes a fresh `currentAdmin` into the Apollo cache, the sidebar, user menu and gate see a role or scope change made elsewhere at the next `/app` navigation. #114 accepted role staleness; this reduces it as a side effect and changes no visibility rule.

### Out of scope (normative)

- API authentication or authorization changes, token refresh, and session lifetime.
- `apps/web/middleware.ts`: it keeps its cookie-presence check, with no JWT decoding or verification.
- `PageVisibilityGate`'s file and contract, including its cache-first read, its six rendering rows, and its "not a session boundary" rule.
- The logout and login flows in `user-menu.tsx` and `app/login/page.tsx`.
- Friendly mapping of `FORBIDDEN` or other API errors on pages.
- Retrying or backing off a failed session check.
- Locales other than `en`.

## 3. Terminology

- **Session evidence:** a result that positively shows there is no valid session. Exactly two results count:
  1. any GraphQL operation result carrying a GraphQL error with `extensions.code === 'UNAUTHENTICATED'`;
  2. a session check that **settles successfully**, with no GraphQL or network error, and `data.currentAdmin == null`. That covers an explicitly null field and, as deliberately defensive client behavior, an absent field. The API declares `currentAdmin` non-null (§1.1), so neither case is expected. Both are treated as "no principal", matching what `landingTarget` and the admin page do today.
- **Not session evidence:**
  - a network failure or HTTP 5xx;
  - a GraphQL error with any other code, including `FORBIDDEN`;
  - a response where `currentAdmin` is absent *because the operation failed* without `UNAUTHENTICATED`.

  In short: a null result is evidence, but a failed check is not.
- **Session signal:** the `packages/client` notification raised for evidence (1).
- **Session check:** the guard's background `currentAdmin` query with `fetchPolicy: 'network-only'` (§4.2).
- **Session redirect:** the guard's `clearStore()` → `router.replace('/login')` sequence (§4.3).
- **Guard lifetime:** from the guard's mount to its unmount. The `/app` layout unmounts when the user leaves `/app`, for example after the session redirect or logout.

## 4. Contracts

### 4.1 Session signal (`packages/client`)

- `packages/client` exports `onSessionInvalid(listener: () => void): () => void`. It registers a listener and returns its unsubscribe function.
- The shared `apolloClient` gains an error link in its link chain, ahead of the transport, so it observes every operation's GraphQL errors. Its exact position in the composition is an M4 decision. For every operation, query or mutation, whose result carries at least one GraphQL error with `extensions.code === 'UNAUTHENTICATED'`, it notifies every currently registered listener. It notifies once per result, however many such errors that result carries.
- The link does not change the result. Errors still reach the operation's caller, so page error handling is unaffected.
- **Subscriber-scoped.** The signal only notifies. It MUST NOT redirect, clear or reset the store, or reference routing, `/login`, or `next/*`. With no registered listener it does nothing.
  - So the `login` mutation's `UNAUTHENTICATED` for bad credentials on `/login` has no effect: `/login` is outside the `/app` layout, so no guard is mounted.
- Network errors and HTTP-level failures do not notify.

### 4.2 `SessionGuard`

`SessionGuard()` is a client component in `apps/web/components/layout/session-guard.tsx`. `apps/web/app/app/layout.tsx` mounts it exactly once, as a sibling of `PageVisibilityGate`:

```tsx
<AppI18nProvider>
  <DashboardLayout>
    <SessionGuard />
    <PageVisibilityGate>{children}</PageVisibilityGate>
  </DashboardLayout>
</AppI18nProvider>
```

**Rendering.** It renders nothing (`null`) and takes no `children`. It never delays, wraps, replaces, or unmounts the page, the gate, or shell chrome. There is no loading state for session validation.

**Reactive evidence.** While mounted, it registers one `onSessionInvalid` listener. Each notification triggers the session redirect (§4.3). It unregisters on unmount.

**Proactive evidence.**

- On mount, and on every subsequent change of `usePathname()`, it starts one session check, through the Apollo client in context, with `fetchPolicy: 'network-only'`.
- A change to search parameters alone is not a pathname change and starts no check.
- The check runs in the background. It is not awaited before rendering anything.
- The check's outcome:
  - It settles successfully with `data.currentAdmin == null` and no error (evidence (2), §3): trigger the session redirect.
  - It returns `UNAUTHENTICATED`: the signal (§4.1) has already notified, so the guard needn't act on this outcome. If it does, the latch (§4.3) folds it into the same single sequence.
  - Any other error: ignore it. No redirect, retry, or UI.
  - It settles with a principal: nothing. A principal result never cancels a session redirect that has already started.
- **Out of order is fine.** Checks are not cancelled when the pathname changes again. Evidence from any check in the guard's lifetime, including one started for an earlier pathname, triggers the session redirect, because the session is global.

**Session only, not visibility.** The guard decides only whether a valid session exists. It MUST NOT call `isGatedPath`, `canViewPath`, `landingHref`, or `visibleNavGroups`, read `viewRoles`, or otherwise decide page visibility or authorization. #114 owns visibility.

### 4.3 Session redirect (single-flight)

1. The guard holds one latch per guard lifetime, initially open. *(#146)* The latch is created once when the guard mounts. It MUST NOT be replaced while the guard stays mounted, even if the Apollo client or router object identity changes. The redirect's effects call the current client and router.
2. On evidence from either source, if the latch is closed, do nothing. Otherwise close it, then `await apolloClient.clearStore()`, then call `router.replace('/login')`.
   - If `clearStore()` rejects, the guard still calls `router.replace('/login')`.
3. Across the guard's lifetime, **at most one** `clearStore()` → `router.replace('/login')` sequence runs, however many signals and check results arrive and in whatever order. This includes a signal and a null check result arriving together.
4. **Unmount stops new evidence, not a committed redirect.**
   - After unmount, no **new** evidence may start a session redirect. That covers a check result that settles after unmount, and a signal delivered after unmount. The listener is unregistered on unmount.
   - A sequence whose latch closed before unmount is already committed, and it **runs to completion** even if the guard unmounts mid-sequence. For example, `clearStore()` is pending when the layout unmounts: `router.replace('/login')` is still called when it settles. Implementations MUST NOT put a "still mounted?" check between `clearStore()` and `router.replace('/login')`.
   - Evidence that arrives after the latch closed, whether before or after unmount, joins the existing sequence and starts nothing new.
5. The order `clearStore()` before navigation matches logout. `clearStore()` discards in-flight queries and does not refetch, so mounted pages may briefly render without data before the route changes. This is existing logout behavior, not a new rendering contract.

Logout is independent of the guard. If a check or signal arrives while logout is already navigating to `/login`, the worst case is the same navigation that logout is performing. That is accepted.

### 4.4 `/app` landing

- `landingTarget({ currentAdmin, error, loading })` no longer returns `'/login'`:
  - while `loading`: `undefined`;
  - when `error` is set or `currentAdmin` is absent: `undefined`;
  - otherwise: `landingHref(currentAdmin)`.
- `apps/web/app/app/page.tsx` keeps its `network-only` `currentAdmin` read and its `router.replace(target)` when there is a target. When it has no target after loading:
  - `error` is set: it renders `nav.landing.error`. If the error was `UNAUTHENTICATED`, the guard is already redirecting. *(#146)* The message is rendered with `role="alert"`, so screen readers announce it, and with the same red text style as `/app/admin`'s `staff.loadError` (§4.5). The loading and empty states keep their style. `@clensy/ui`'s `ErrorState` is not used or changed.
  - `currentAdmin` is absent and there is no error: it renders `nav.landing.loading`, because the guard's own check settles the same result and redirects.
  - otherwise (a principal with no visible destination): it renders `nav.landing.empty`, as today.
- The landing page MUST NOT call `router.replace('/login')`.

### 4.5 `/app/admin`

- `apps/web/app/app/admin/page.tsx` drops its page-local effect that calls `router.replace('/login')`, and its `useRouter` import if nothing else uses it.
- It keeps its `network-only` `currentAdmin` read and its use of `currentAdmin.id` for `StaffConsole`.
- While loading it renders `staff.page.loading`, as today. When `error` is set or `currentAdmin` is absent, it renders the existing `staff.loadError` text in place of the current `null`. If the cause was a session failure, the guard is already redirecting.
- Its visibility decision stays with `PageVisibilityGate` (#114 §4.5), unchanged.

### 4.6 Copy

One key is added to `apps/web/messages/en/nav.json`:

| Key | `en` text |
| --- | --- |
| `nav.landing.error` | Unable to load your account. |

The copy deliberately doesn't claim the session is invalid. When it is invalid, the guard redirects.

### 4.7 Worked examples

| Situation | Path | Evidence | Result |
| --- | --- | --- | --- |
| Session expired mid-session; page visible to the cached role | `/app/cleaners/teams` (any data page) | The page's query → `UNAUTHENTICATED` (signal) | The page's error may flash, then one session redirect |
| Session expired mid-session; page hidden from the cached role | `/app/admin` as `OPS_MANAGER` | Pathname change → check → `UNAUTHENTICATED` (signal) | The unavailable state shows briefly, then one session redirect |
| Account disabled by its owner mid-session | Any `/app/*` | The next operation or navigation check → `UNAUTHENTICATED` | One session redirect |
| Cold load with an expired cookie | `/app` | The landing's read and/or the guard's check → `UNAUTHENTICATED` → the first signal closes the guard's latch; any further signal joins it | `nav.landing.error` may flash, then one session redirect |
| The API is unreachable | `/app` | Check fails with a network error: not evidence | The landing shows `nav.landing.error`; no redirect |
| The API is unreachable | `/app/bookings` | Not evidence | The page's own load error; no redirect |
| Role denied by the API | Any | `FORBIDDEN`: not evidence | The page's own error; no redirect |
| Bookings pagination | `/app/bookings?page=2` → `?page=3` | No pathname change; no check | Unchanged |
| Wrong password | `/login` | `UNAUTHENTICATED` from `login`; no listener | The login form's own error; no redirect |
| Logout | Any `/app/*` | — | The user menu's existing `logout()` → `clearStore()` → `replace('/login')`, unchanged |

## 5. Invariants (MUST / MUST NOT)

1. The session guard and the signal are UX only. They MUST NOT be, or be documented as, authentication or authorization. The API remains the sole authority (Admin Foundation §4.8; multi-tenant §5 invariant 13).
2. Only session evidence (§3) triggers the session redirect. A network failure, HTTP 5xx, `FORBIDDEN`, or any other error MUST NOT trigger it.
3. **(Single-flight.)** Within one guard lifetime, at most one `clearStore()` → `router.replace('/login')` sequence runs. Signals and null check results feed the same latch.
4. `clearStore()` MUST complete (resolve or reject) before `router.replace('/login')` is called, in both the session redirect and logout.
5. **(Subscriber-scoped signal.)** `packages/client` MUST NOT redirect, clear or reset the store, or depend on routing in response to `UNAUTHENTICATED`. It only notifies registered listeners.
6. The guard MUST NOT block, delay, wrap, or unmount page content or shell chrome, and MUST render nothing.
7. The guard MUST NOT make page-visibility or authorization decisions, and MUST NOT use `isGatedPath`, `canViewPath`, `landingHref`, `visibleNavGroups` or `viewRoles`.
8. The guard MUST be mounted exactly once, in `apps/web/app/app/layout.tsx`. No page mounts its own.
9. The session check MUST use `fetchPolicy: 'network-only'`, MUST start on mount and on each pathname change, and MUST NOT start on a change to search parameters alone.
10. After unmount, no new evidence (a check result or signal arriving after unmount) may start a session redirect. A sequence whose latch closed before unmount MUST run to completion, including `router.replace('/login')`.
11. `PageVisibilityGate`'s contract (#114 §4.2, §5 invariants 4–7) is unchanged. In particular the gate MUST NOT import the session signal or the guard, redirect, or inspect API errors.
12. Apart from logout in `components/layout/user-menu.tsx` and the session redirect in `components/layout/session-guard.tsx`, no `apps/web/app/app/**` or `apps/web/components/**` source file may navigate to `/login`. `app/login/page.tsx` and `middleware.ts` are outside this rule.
13. `middleware.ts` MUST NOT decode, verify, or trust the JWT (Admin Foundation §4.8).

## 6. Goals and non-goals

**Goals**

- On every `/app/*` page, the user is redirected to `/login` when session evidence (§3) is observed: an operation returns `UNAUTHENTICATED`, or a navigation-time check finds no principal. This includes a mid-session expiry followed by navigation to a page the gate denies from the cached principal. An invalid session that produces no evidence, for example while idle on one page, is deferred (§11).
- One place owns that rule. The `/app` and `/app/admin` copies are retired, not duplicated a third time.
- An API outage or a role denial never looks like a logout.
- Rendering is never serialized behind session validation.

**Non-goals**

- Hardening security. The API is already the boundary.
- Token refresh, silent re-authentication, session lifetime, or "your session expired" messaging on `/login`.
- Returning the user to their original page after signing in again.
- Changing `PageVisibilityGate`, middleware, logout, or login.
- Retrying failed session checks, polling, or detecting expiry while the user is idle on one page.
- Friendly mapping of `FORBIDDEN` or other errors on pages.

## 7. Rationale

- **A layout-level guard (issue option A), not per page (B) or middleware (C).**
  - **Middleware (C)** cannot see a disabled account, which needs the database. It would need the JWT secret in `apps/web`. And Admin Foundation §4.8 forbids middleware from decoding or trusting the JWT.
  - **Per-page hooks (B)** must be remembered for every new page. They also wouldn't cover a page the gate denies, because a denied page is never mounted.
  - **One layout mount (A)** covers every current and future `/app` page.
- **A sibling, not inside the gate.** #114 locks the gate as "not a session boundary". Keeping the guard beside it leaves that contract and its tests untouched. It also keeps visibility and session concerns in separate units.
- **Signal plus a navigation check.**
  - The signal alone misses the headline case, because a gate-denied page sends no request.
  - The navigation check alone would miss a failure in a mutation or refetch while the user stays on a page.
  - A check triggered only on deny would put session logic in the gate.
  - The price of the chosen design is one small `currentAdmin` request per `/app` pathname change.
- **Non-blocking, accepting a brief flash.** A blocking guard would put session validation on every page's rendering path and add a second loading state. Briefly showing the page's error or the unavailable state before the redirect is accepted: both are correct for the last known principal.
- **Only positive evidence.** The current landing treats any `currentAdmin` failure as logout, so an outage signs everyone out. `UNAUTHENTICATED` is the API's explicit statement that the session is invalid. Anything else means "unknown", which the page's own error UI already handles.
- **Signal in `packages/client`, routing in `apps/web`.** The client package owns the link chain but has no router. A subscriber-scoped notification keeps routing in the app. It also makes the `/login` wrong-password case safe without special-casing the `login` operation.
- **`clearStore()` before navigating.** This is the order logout already uses. It ensures the next principal never renders with the previous one's cached nav or role.

## 8. Verification contract

These are acceptance anchors for M4–M7. Test file names are planning decisions.

1. **Session signal** (unit, `packages/client`):
   - A result with an `UNAUTHENTICATED` GraphQL error notifies every registered listener once.
   - A single result carrying several GraphQL errors, including more than one `UNAUTHENTICATED` error, notifies each listener exactly once.
   - `FORBIDDEN`, another GraphQL error code, a network error, and a successful result do not notify.
   - With no listener registered, an `UNAUTHENTICATED` result has no effect and still reaches the caller unchanged.
   - Unsubscribe stops notifications.
2. **`SessionGuard`** (component tests, with a mocked Apollo client and router):
   - **Rendering:** it renders nothing. A sibling probe component is mounted on the first render, before any check settles.
   - **Settled null:** a check that settles successfully with `currentAdmin` null gives exactly one `clearStore()`, then one `replace('/login')`, in that order. The order is asserted, not just the final URL.
   - **Failed check without `UNAUTHENTICATED`:** a check that fails with a network error, `FORBIDDEN`, or another error code gives no `clearStore()` and no `replace()`. This includes a response where `currentAdmin` is absent because of the error.
   - **Signal:** an `onSessionInvalid` notification gives the one sequence.
   - **Single-flight:** several notifications, or a notification plus a settled-null result, in either order, give exactly one sequence.
   - **Principal result:** a check settling with a principal gives no redirect, and doesn't cancel one already started.
   - **Triggers:** mount starts one `network-only` check. A pathname change starts another. A search-parameter-only change starts none.
   - **Out of order:** a null result from a check started for an earlier pathname still redirects.
   - **Unmount, new evidence:** with the latch still open, a null result settling after unmount and a notification after unmount give no `clearStore()` and no `replace()`. The listener is unregistered.
   - **Unmount, committed redirect:** evidence closes the latch, the guard unmounts while `clearStore()` is pending, and when `clearStore()` resolves, `replace('/login')` is still called exactly once.
   - **`clearStore()` rejection:** `replace('/login')` is still called once.
   - *(#146)* **One latch per mount:** a source regression pins that the effect creating the redirector runs once per mount (no `client` or `router` dependency), and that its `clearStore` and `navigateToLogin` call through refs to the current client and router.
3. **Landing** (unit, `landing-target.test.ts`, and the page):
   - `landingTarget` never returns `'/login'`: `undefined` while loading, on error, and on an absent principal; `landingHref` otherwise.
   - The page renders `nav.landing.error` on error, and `nav.landing.empty` for a principal with no destination.
   - *(#146)* The error renders inside an element with `role="alert"`. The loading and empty states do not.
4. **Admin page:** with `currentAdmin` errored or absent, it renders the `staff.loadError` text and calls no router method.
5. **Source regressions**, in the style of `web-shell-regressions.test.ts` / `tenant-role-regressions.test.ts`:
   - `app/app/layout.tsx` mounts `SessionGuard` exactly once, inside `DashboardLayout`, as a sibling of `PageVisibilityGate`.
   - `components/layout/page-visibility-gate.tsx` does not reference `onSessionInvalid`, `SessionGuard`, or `/login`.
   - Navigation to `'/login'` appears in no `apps/web/app/app/**` or `apps/web/components/**` non-test source file except `components/layout/session-guard.tsx` and `components/layout/user-menu.tsx` (invariant 12). The scan is scoped exactly to these trees. *(#146)* The scan is literal-based, not call-based. Any string or template literal (parsed with the TypeScript AST, so comments are ignored) whose value is `/login`, or starts with `/login?` or `/login/`, counts. So a path constant or a `window.location` call is caught too.
   - `components/layout/session-guard.tsx` does not reference `canViewPath`, `isGatedPath`, `landingHref`, `visibleNavGroups` or `viewRoles` (invariant 7).
   - `packages/client` source does not reference `/login`, `next/`, `clearStore` or `resetStore` (invariant 5).
6. **Copy:** `nav.landing.error` exists in `apps/web/messages/en/nav.json` with the §4.6 text.
7. **Existing suites stay green:** the `PageVisibilityGate` tests unchanged, the `apps/web` unit/component tests, typecheck, lint, the `packages/client` and `@clensy/web` tests, and the API suites. No API source changes.

## 9. Traceability

| Dependency | Relationship |
| --- | --- |
| Admin Foundation §4.8, §6 item 6 | **Relied upon** unchanged. Middleware stays a cookie-presence UX hint. This spec moves the "downstream" catch for a present but invalid cookie from two pages into one layout guard. |
| Multi-Tenant Architecture §5 invariant 13 | **Relied upon** unchanged. The guard is navigation-level UX, never a security boundary. |
| Role-Aware Typed URLs (#114) §4.2, §5 invariants 4–7 | **Relied upon** unchanged. The gate's file, cache-first read, rendering rows and "not a session boundary" rule are untouched. |
| Role-Aware Typed URLs (#114) §2 Informative, §4.5 redirect lifecycle, §4.6 expired-session rows, §11 | **Constrained.** Responsibility for the session redirect described in those passages moves to this spec: the admin page no longer redirects itself, and the guard redirects on evidence for every page. A cross-reference amendment under #131 records only that move in the #114 spec. It makes no second design decision, and §4.2, including its role-staleness note, is unchanged. Any freshening of the shared cache by the session check (§2 Informative) is a side effect owned here. |
| Web Shell and Design System | **Relied upon**: the single `/app` layout. One render-less component is added inside it, and shell chrome is unchanged. |
| #89 shell slice (`landing-target.ts`) | **Changed**: `landingTarget` loses its `/login` outcome (§4.4). `landingHref` is unchanged. |
| Staff Administration UI (#88) | **Changed** for the session redirect only (§4.5). The console's queries, mutations and error mapping are unchanged. |

## 10. Acceptance criteria (for this specification)

This specification may move from Draft to Accepted at M3 when the reviewer agrees that:

1. The decision is locked and justified (§1, §7): a single non-blocking layout guard beside the gate, with a subscriber-scoped `UNAUTHENTICATED` signal and a navigation-time `network-only` check.
2. Session evidence vs. non-evidence is unambiguous (§3, §5 invariant 2). This includes "settled null is evidence; a failed check is not", and that `FORBIDDEN`, network failures and 5xx never redirect.
3. The single-flight redirect, its `clearStore()`-first order, its unmount behavior (new evidence stopped; a committed sequence completes), and its independence from logout are unambiguous (§4.3, §5 invariants 3–4, 10).
4. The guard is shown to make no visibility decision, and `PageVisibilityGate`'s #114 contract is unchanged (§4.2, §5 invariants 7, 11).
5. The retirement of the `/app` and `/app/admin` redirects, the new landing and admin error states, and the `nav.landing.error` copy leave no product decision to M4 (§4.4–§4.6).
6. The worked examples and verification contract cover the hidden-page case, the outage case, the `FORBIDDEN` case and the `/login` wrong-password case (§4.7, §8).
7. Nothing here changes API authentication or authorization, middleware, or the Accepted Admin Foundation, multi-tenant and #114 contracts beyond the cross-reference amendment (§5, §9).

**#146 amendment.** Criteria 1–7 are unaffected and stay met. The amendment may move from Draft to Accepted at M3 when the reviewer agrees that:

8. Three points are unambiguous: the one-latch-per-mount rule regardless of client or router identity (§4.3 item 1); the landing error's `role="alert"` and its admin-matching style (§4.4); and the literal-based `/login` scan (§8 item 5). They change no session semantics, no copy, no `@clensy/ui` component, and no #114 contract.

## 11. Explicit deferrals

- **Returning to the original page after sign-in** (a `next`/`returnTo` parameter on `/login`). This needs an open-redirect-safe design of its own.
- **"Your session has expired" messaging on `/login`.**
- **Idle detection.** A user who stays on one page and sends no request is not redirected until their next operation or navigation.
- **Token refresh and session lifetime**, as the issue excludes.
- **Additional locales** for `nav.landing.error`.
