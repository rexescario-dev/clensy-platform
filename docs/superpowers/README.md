# Design records

Specifications and implementation plans, produced by the project's [engineering workflow](../workflows/README.md) (M2 spec → M3 design review → M4 plan → M5 plan review → M6 implementation). They are **records**: they explain why the system is the way it is. For how it works now, start at the [documentation home](../README.md).

## How to read them

- **Specs** (`specs/`) define contracts. A spec whose Status is **Accepted** is binding for the behavior it covers, including any Accepted amendments recorded in its Status row. If a current guide and an Accepted spec disagree, the spec wins and the guide is a bug to fix.
- **Plans** (`plans/`) are execution records for one delivery slice: task lists, review rounds, rulings and verification. They are historical once the slice merges; don't update them to match later code.
- File names start with the date the document was written. New specs and plans go here, named `YYYY-MM-DD-<topic>-design.md` and `YYYY-MM-DD-<topic>-plan.md`.

## Specifications by area

### Platform and API

| Spec | Status |
| --- | --- |
| [Phase 1 design](specs/2026-08-14-clensy-platform-phase1-design.md): product scope, monorepo layout, module layering | Foundational; no Status field. Its planned `quality` and `dashboard` modules were not built. |
| [Admin foundation](specs/2026-08-14-admin-foundation-design.md): auth, roles, staff accounts, audit | Accepted |
| [Multi-tenant architecture](specs/2026-09-23-multi-tenant-architecture-design.md): tenants, scopes, roles, isolation, relation-field authorization | Accepted, with amendments |
| [nestjs-query GraphQL reads](specs/2026-08-28-nestjs-query-graphql-reads-design.md) | Accepted |
| [Paginated GraphQL collections](specs/2026-08-28-paginated-graphql-collections-design.md) | Accepted |
| [Required CI checks on `main`](specs/2026-10-06-required-ci-checks-design.md) | Accepted |
| [React Hooks lint rules](specs/2026-10-18-react-hooks-lint-rules-design.md): `rules-of-hooks` and `exhaustive-deps` at `error` in the React workspaces | Accepted |

### Business modules

| Spec | Status |
| --- | --- |
| [Customers & properties](specs/2026-08-15-customers-properties-design.md) | Accepted |
| [Cleaners & teams](specs/2026-08-16-cleaners-teams-design.md) | Accepted |
| [Catalog](specs/2026-08-16-catalog-design.md) | Accepted |
| [Bookings](specs/2026-08-22-bookings-design.md) | Accepted |
| [Jobs & checklists](specs/2026-08-27-jobs-checklists-design.md) | Accepted |
| [Laundry architecture & catalog foundation](specs/2026-09-06-laundry-catalog-foundation-design.md) | Accepted |
| [Laundry orders & lifecycle](specs/2026-09-06-laundry-orders-lifecycle-design.md) | Accepted, with Amendment #164 (order workspace) |
| [Laundry invoices](specs/2026-09-06-laundry-invoices-design.md) | Accepted |

### Web console

| Spec | Status |
| --- | --- |
| [Dashboard UX foundation](specs/2026-08-17-dashboard-ux-foundation-design.md) | Accepted |
| [Web shell & design system](specs/2026-09-10-web-shell-and-design-system-design.md) | Accepted |
| [i18n architecture (next-intl)](specs/2026-09-13-web-i18n-architecture-design.md) | Accepted |
| [`@clensy/validation`](specs/2026-09-15-clensy-validation-design.md) | Accepted |
| [`@clensy/ui` as the shared UI system](specs/2026-09-16-shadcn-ui-boundary-design.md) | Accepted |
| [`@clensy/web` and the login form](specs/2026-09-19-clensy-web-login-form-design.md) | Accepted |
| [Reusable `DataTable`](specs/2026-09-19-reusable-data-table-design.md) | Accepted |
| [Component `errorMessage` API](specs/2026-09-20-component-error-message-api-design.md) | Accepted |
| [Self-translating `LoginForm`](specs/2026-09-20-login-form-self-translating-design.md) | Accepted |
| [`BookingDataTable` sorting and pagination](specs/2026-09-21-booking-datatable-sorting-pagination-design.md) | Accepted |
| [Single app i18n provider](specs/2026-10-02-single-app-i18n-provider-design.md) | Accepted, with amendments |
| [Tenant label overrides](specs/2026-10-03-tenant-label-overrides-design.md) | Accepted, with amendment |
| [Role-aware typed URLs](specs/2026-10-04-role-aware-typed-urls-design.md) | Accepted, with amendments |
| [Session routing](specs/2026-10-07-session-routing-design.md) | Accepted, with amendment |
| [Document titles](specs/2026-10-08-app-document-titles-design.md) | Accepted |

## Plans

One plan per delivery slice, 70 so far, in [`plans/`](plans/). The file name gives the date and topic; the plan's header names its GitHub issue and spec. Slices that changed the API's behavior also have a short note in [shipped slices](../history/shipped-slices.md).
