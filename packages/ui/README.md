# @clensy/ui

The shared UI system for `apps/web` (and any future consumer). shadcn,
`radix-ui`, and `class-variance-authority` are `@clensy/ui`'s internal
implementation foundation, not the architecture itself — `apps/web` knows
only `@clensy/ui`'s public API and has no shadcn/Radix-specific knowledge of
its own. See [the design spec](../../docs/superpowers/specs/2026-09-16-shadcn-ui-boundary-design.md)
for the full architecture and rationale.

**Boundary this package enforces:**

- Generic UI primitives (shadcn/radix-ui-based) live in `src/base/`.
- Generic Clensy UI composition lives in `src/base/`, alongside the primitives.
- Domain-specific composition belongs in `src/domain/`.
- This package must not import from `apps/web` (or any application).
- This package must not contain routing, business logic, or application-level
  data fetching (existing rule, unchanged — see `apps/web/README.md`'s i18n
  boundary for the equivalent `next-intl` restriction).
- This package consumes the application's semantic theme tokens by class name;
  it does not own or inject the token CSS itself.

## Layout

- `src/base/` — every generic primitive (`Avatar`, `Button`, `Checkbox`,
  `DropdownMenu`, `Input`, `Label`, `Separator`, `Sheet`, `Skeleton`, `Table`,
  `Tooltip`) and every generic composition (`Modal`, `DataTable`, `Pagination`,
  the `Field` family (`Field`, `FieldLabel`, `FieldGroup`, and related
  sub-components), `FormField`, `StatusBadge`, `PageHeader`, `LoadingState`,
  `EmptyState`, `ErrorState`, `ToastProvider`/`useToast`, `DetailDrawer`),
  flat — including `base/dialogs/` for `FormDialog` and `ConfirmDialog`.
  There's no separate "primitives" folder: a consumer importing from
  `@clensy/ui` doesn't need to know or care whether a given export is
  shadcn-backed or hand-composed. `DataTable` is a behavior/composition layer
  over `Table`, `Checkbox`, and `Pagination` — it is not a table primitive
  itself; see [the design spec](../../docs/superpowers/specs/2026-09-19-reusable-data-table-design.md)
  §4.3.
- `src/domain/` — **legacy, no new content.** Domain-specific composition
  (components representing a Clensy business concept) now belongs in
  [`@clensy/web`](../../packages/web/README.md) instead; see [the design
  spec](../../docs/superpowers/specs/2026-09-19-clensy-web-login-form-design.md)
  §4.1. `src/domain/` stays scaffolded but receives no new content after
  2026-09-19. See [`src/domain/README.md`](src/domain/README.md) for details.
- `src/internal/` — implementation details not part of the public export
  surface.
- `src/index.ts` — the public export surface: every `base/` export. `domain/`
  has nothing to export yet.

## Theme tokens

`@clensy/ui`'s primitives consume the application's semantic Tailwind tokens
(`bg-primary`, `text-destructive`, …) by class name — this package does not
own, inject, or duplicate the token CSS itself. `apps/web/app/globals.css` is
today's sole source of those token definitions. This is a CSS custom-property
contract at the rendered-page level, not a module/package dependency:
`@clensy/ui` doesn't `import` anything from `apps/web` to consume these
classes, and nothing about which application injects the tokens affects how
`@clensy/ui` renders.

## Migrating off the old `Button`

`base/button.tsx` is a verbatim shadcn primitive and, unlike the old
`@clensy/ui` `Button` it replaced, does not default `type` to `"button"` — it
spreads `...props` straight onto the underlying `<button>`. A `<Button>`
rendered without an explicit `type` inside a `<form>` now falls back to the
browser's native `submit` behavior. Callers that want non-submit behavior
inside a `<form>` must pass `type="button"` explicitly.

## Adding a new primitive

Future shadcn component generation targets `packages/ui/src/base/`, not
`apps/web` — `apps/web/components.json` is not an architectural fixture of
`apps/web`. This package has its own `components.json` (aliases pointed at
`src/base`, not the `@/`-prefixed convention `apps/web`'s used — this
package has no such path alias configured in `tsconfig.json`, so the CLI
writes relative to `packages/ui`'s own root instead). To add a primitive,
run from within `packages/ui`:

```bash
npx shadcn@latest add <component>
```

This workflow was established while adding `Table` and `Checkbox` for the
[reusable `DataTable` design](../../docs/superpowers/specs/2026-09-19-reusable-data-table-design.md).
