# `domain/`

**Legacy as of 2026-09-19 — no new content is ever added here.**
Domain-specific composition (components that know about a specific Clensy
business domain) now belongs in [`@clensy/web`](../../../web/README.md)
instead; see the [design
spec](../../../../docs/superpowers/specs/2026-09-19-clensy-web-login-form-design.md)
§4.1. This directory stays scaffolded, unpopulated, for historical reference
only.

Originally reserved for business-domain-specific composition (e.g. a
hypothetical `domain/customers/CustomerDataTable`) when this package's
`base/` migration scaffolded it empty (2026-09-16) — components that know
about a specific Clensy business domain, as opposed to `base/`'s
domain-agnostic primitives and generic composition. That plan is superseded
by `@clensy/web`; see above.

`domain/` components may depend on `base/` (primitives and generic
composition). They must not be depended on by `base/`.
