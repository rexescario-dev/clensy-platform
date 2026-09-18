# @clensy/web

Reusable Clensy domain components — the sole home for components representing Clensy business concepts, positioned between `@clensy/ui` (generic UI primitives and composition) and `apps/web` (application-level page and component composition). See [the design spec](../../docs/superpowers/specs/2026-09-19-clensy-web-login-form-design.md) §1 and §4.1 for the full architecture and rationale.

**Boundary this package enforces:**

- Domain components (components representing a Clensy business concept) live here, grouped by domain (e.g. auth/).
- This package must not import shadcn, radix-ui, or apps/web/components/ui directly — UI primitives come only through @clensy/ui.
- This package must not import @clensy/client, @apollo/client, or any other GraphQL/network client — host applications inject data actions (e.g. LoginForm's onLogin) instead.
- This package must not import next-intl or hold a message catalog — it takes already-translated strings as props; apps/web translates.
- This package must not import from apps/web.

## LoginForm

`auth/LoginForm` is a client-side login form component that validates input, presents server-error feedback, and calls a host-provided `onLogin` callback to perform authentication. The component takes already-translated strings as props (`labels: { title, email, password, submit, submitting }`) and a generic `errorMessage` string for mutation failures — see [the design spec](../../docs/superpowers/specs/2026-09-19-clensy-web-login-form-design.md) §3 for the full contract and error-handling rationale.
