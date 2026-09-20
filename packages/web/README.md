# @clensy/web

Reusable Clensy domain components — the sole home for components representing Clensy business concepts, positioned between `@clensy/ui` (generic UI primitives and composition) and `apps/web` (application-level page and component composition). See [the design spec](../../docs/superpowers/specs/2026-09-19-clensy-web-login-form-design.md) §1 and §4.1 for the full architecture and rationale.

**Boundary this package enforces:**

- Domain components (components representing a Clensy business concept) live here, grouped by domain (e.g. auth/).
- This package must not import shadcn, radix-ui, or apps/web/components/ui directly — UI primitives come only through @clensy/ui.
- This package must not import @clensy/client, @apollo/client, or any other GraphQL/network client — host applications inject data actions (e.g. LoginForm's onLogin) instead.
- This package must not import next-intl — framework/application i18n integration stays in apps/web.
- This package must not import from apps/web.

**Known, intentional inconsistency (not yet reconciled):** `LoginForm` takes already-translated strings as props (apps/web translates). `BookingDataTable` instead owns its own default `en` message catalog under `src/i18n/` and resolves translations itself via `useClensyTranslations` — apps/web may layer partial overrides on top through `ClensyI18nProvider`, deep-merged with the package defaults, but doesn't have to. Both patterns are valid `@clensy/web` architecture today; unifying them onto one pattern is a deliberately deferred follow-up, not an oversight — see [the design addendum](../../docs/superpowers/specs/2026-09-19-reusable-data-table-design.md) for the tradeoff.

## LoginForm

`auth/LoginForm` is a client-side login form component that validates input, presents server-error feedback, and calls a host-provided `onLogin` callback to perform authentication. The component takes already-translated strings as props (`labels: { title, email, password, submit, submitting }`) and a generic `errorMessage` string for mutation failures — see [the design spec](../../docs/superpowers/specs/2026-09-19-clensy-web-login-form-design.md) §4.4 for the full contract and §5 for the `onLogin` resolve/reject error-handling rationale.

## BookingDataTable

`bookings/BookingDataTable` owns Bookings' domain-specific table columns (Customer, Property, Service, Scheduled, Status, Team, Price) and rendering, delegating generic table behavior (pagination, and — unused by Bookings today — sorting and selection) to `@clensy/ui`'s `DataTable`. It takes plain booking values, a host-injected `formatPrice` callback (price formatting lives in `apps/web`, which this package must not import from), and pagination props — see [the design spec](../../docs/superpowers/specs/2026-09-19-reusable-data-table-design.md) §4.4 for the full contract, including why `Booking`'s shape is a structural pass-through of the host's GraphQL result rather than an explicit view model.

Column headers and generic strings (`Unassigned`, `No bookings.`) come from `useClensyTranslations('bookings')`, not props — the component is fully functional with zero application-level integration, using its own `src/i18n/messages/en/bookings.ts` defaults.

## i18n (`src/i18n/`)

`@clensy/web` may own default `en` messages for components that opt into translation (`BookingDataTable` today; `LoginForm` does not, see above). `getDefaultMessages()` assembles the flat, namespace-keyed catalog (mirrors `apps/web/i18n/messages.ts`'s own `getMessages()` convention). `ClensyI18nProvider` (optional — components work with no Provider in the tree at all) takes a plain `locale` string and an optional `overrides` object, deep-merged onto the package defaults via `deepMerge` — never a shallow spread, so overriding one leaf never drops its siblings. `useClensyTranslations(namespace)` returns a `t(key)` function scoped to that namespace. This package has no next-intl dependency; the host application (apps/web) is responsible for resolving its own real locale (via its own next-intl setup) and passing it to `ClensyI18nProvider` as a plain string.
