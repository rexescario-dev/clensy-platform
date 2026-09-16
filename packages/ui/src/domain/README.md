# `domain/`

Reserved for business-domain-specific composition (e.g. a hypothetical
`domain/customers/CustomerDataTable`) — components that know about a specific
Clensy business domain, as opposed to `base/`'s domain-agnostic primitives and
generic composition.

Empty as of this package's `base/` migration (2026-09-16) — no second consumer
has needed a domain-specific extraction yet. Populate this directory only when
one genuinely does; do not seed it speculatively (see the design spec's
rationale, §5).

`domain/` components may depend on `base/` (primitives and generic
composition). They must not be depended on by `base/`.
