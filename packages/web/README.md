# @clensy/web

Reusable Clensy domain components — the sole home for components representing Clensy business concepts, positioned between `@clensy/ui` (generic UI primitives and composition) and `apps/web` (application-level page and component composition). See [the design spec](../../docs/superpowers/specs/2026-09-19-clensy-web-login-form-design.md) §1 and §4.1 for the full architecture and rationale.

**Boundary this package enforces:**

- Domain components (components representing a Clensy business concept) live here, grouped by domain (e.g. auth/).
- This package must not import shadcn, radix-ui, or apps/web/components/ui directly — UI primitives come only through @clensy/ui.
- This package must not import @clensy/client, @apollo/client, or any other GraphQL/network client — host applications inject data actions (e.g. LoginForm's onLogin) instead.
- This package must not import next-intl or hold a message catalog — it takes already-translated strings as props; apps/web translates.
- This package must not import from apps/web.

## LoginForm

`auth/LoginForm` is a client-side login form component that validates input, presents server-error feedback, and calls a host-provided `onLogin` callback to perform authentication. The component takes already-translated strings as props (`labels: { title, email, password, submit, submitting }`) and a generic `errorMessage` string for mutation failures — see [the design spec](../../docs/superpowers/specs/2026-09-19-clensy-web-login-form-design.md) §4.4 for the full contract and §5 for the `onLogin` resolve/reject error-handling rationale.

## BookingDataTable

`bookings/BookingDataTable` owns Bookings' domain-specific table columns (Customer, Property, Service, Scheduled, Status, Team, Price) and rendering, delegating generic table behavior (pagination, and — unused by Bookings today — sorting and selection) to `@clensy/ui`'s `DataTable`. It takes plain booking values, a host-injected `formatPrice` callback (price formatting lives in `apps/web`, which this package must not import from), and pagination props — see [the design spec](../../docs/superpowers/specs/2026-09-19-reusable-data-table-design.md) §4.4 for the full contract, including why `Booking`'s shape is a structural pass-through of the host's GraphQL result rather than an explicit view model.
