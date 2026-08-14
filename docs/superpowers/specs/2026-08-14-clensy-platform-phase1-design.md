# Clensy Platform — Phase 1 Design

Date: 2026-08-14

## 1. Context & Goals

`clensy-platform` started as a NestJS + TypeORM + GraphQL comparison harness (evaluating TypeORM against `flash-sale-system`'s Prisma stack, and REST against GraphQL). That comparison goal is dropped. This repository is now the real Clensy product: an internal operations platform (admin dashboard + API) for a cleaning-services business, covering booking, scheduling, workforce management, service catalog/pricing, job execution, and quality/re-clean workflows.

Phase 1 goal: a secure, usable internal operations tool covering the business's core operational loop — customer/property intake, workforce setup, service catalog, booking, job execution with checklists, and quality resolution — with a real operations dashboard reading across all of it. Everything else in the original product vision (payments, notifications, customer portal, commercial/Airbnb variants, reporting, etc.) is roadmap, not Phase 1.

## 2. Architecture

### 2.1 Monorepo Layout

```text
apps/
├── api/      NestJS + TypeORM + GraphQL (existing app, extended)
└── web/      Next.js dashboard (new)

packages/
├── ui/       shared UI primitives, API/domain-agnostic
└── client/   Apollo Client instance + graphql-codegen generated types/hooks

apps/api/src/
├── platform/               shared infrastructure, not business logic
│   ├── config/
│   ├── database/
│   ├── graphql/
│   ├── auth/                new — JWT strategy, guards, RBAC decorators
│   └── audit/                new — AuditEvent entity + AuditLogger service
│
└── modules/
    ├── admins/               new — AdminUser, Role; login use case, staff CRUD
    ├── customers/            new — Customer, Property (Property nested, not standalone)
    ├── cleaners/             new — Cleaner, Team
    ├── catalog/               new — Service, AddOn, PricingRule
    ├── bookings/              existing, reworked — real FKs replace fake fields
    ├── jobs/                  new — CleaningJob, Checklist
    ├── quality/                new — QualityIssue, ReCleanJob
    └── dashboard/               new — read-only aggregation, no domain/infrastructure
```

Every business module (all except `dashboard`) keeps the existing layered shape: `domain/` (plain TS) → `application/` (commands/queries + services) → `infrastructure/` (TypeORM entities, persistence) → `presentation/` (GraphQL only for every module except `bookings`, which also keeps its existing REST surface as a reference implementation — see §2.6 and the project README's "Two presentation surfaces" note).

### 2.2 Platform

- `platform/auth`: Passport JWT strategy, `AuthGuard`, `@Roles()` / `@CurrentUser()` decorators. Answers "how do we authenticate this request?" Fixed 6-role permission matrix (Owner, Operations Manager, Scheduler, Customer Support, Finance, Read-only Analyst), enforced here. Does not own admin identity data — resolves it through `modules/admins`' application contract, not a direct dependency on its infrastructure.
- `platform/audit`: `AuditEvent` entity + `AuditLogger` service. Modules call `audit.log({ actorId, action, entityType, entityId, metadata })` from their application layer on relevant mutations. Audit owns persistence and querying of audit events; it is not itself a business module and has no GraphQL presentation of its own in Phase 1 beyond what's needed to view the log.

### 2.3 Business Modules

| Module | Domain objects | Notes |
|---|---|---|
| `admins` | AdminUser, Role | Login use case, staff account CRUD. Distinct from `platform/auth` — "who is this staff member and what can they do?" vs. "how do we authenticate this request?" |
| `customers` | Customer, Property | Property stays nested under `customers` in Phase 1 (see §8) — it has no meaningful lifecycle independent of a Customer today. |
| `cleaners` | Cleaner, Team | Workforce and team assignment. |
| `catalog` | Service, AddOn, PricingRule | "What Clensy sells and how it's priced." Named `catalog`, not `services`, to avoid the word collision with NestJS's own `*Service` convention. |
| `bookings` | Booking | "What a customer actually booked." Reworked to hold `customerId`/`propertyId`/`serviceId` real relations in place of today's fake `customerName`/`serviceType` strings. Captures a pricing snapshot at booking time rather than a live reference to current catalog pricing — a later price change in `catalog` must not retroactively alter what a historical booking appears to have cost. Existing REST surface, tests, and status model preserved — this is a migration, not a rewrite. |
| `jobs` | CleaningJob, Checklist | "What the operations team needs to execute." Deliberately separate from `bookings`: a booking can outlive/precede/diverge from the job(s) it generates. |
| `quality` | QualityIssue, ReCleanJob | A re-clean is modeled as caused by a QualityIssue's resolution, not as an ordinary new Booking. |

### 2.4 Dashboard Read Model

`modules/dashboard` owns no domain objects and no infrastructure. It has:

```text
modules/dashboard/
├── application/
│   └── queries/        get-operations-summary.ts, get-todays-jobs.ts, get-attention-items.ts, ...
└── presentation/
    └── graphql/
```

The application-layer queries orchestrate reads across other modules' **application/read contracts** — never their repositories or TypeORM entities directly (see §2.6). If a future performance need justifies a dedicated dashboard read model/materialized view, that's a deliberate, documented architecture change, not an accidental shortcut.

### 2.5 Shared Packages

- `packages/ui`: API/domain-agnostic components (`DataTable`, `StatusBadge`, `Modal`, `FormField`). Domain-specific components (`BookingTable`) stay in `apps/web` unless a component is genuinely reusable across modules.
- `packages/client`: GraphQL-specific, not a generic API client. Apollo Client setup + `graphql-codegen`-generated types/hooks against `apps/api`'s schema.

### 2.6 Cross-Module Dependency Rules

> Modules communicate through explicitly exposed application contracts and stable identity/value types. Presentation layers are external adapters and should not be used as internal module dependencies. A module never reaches into another module's infrastructure or persistence implementation.

Concretely: `bookings` references `customerId`/`propertyId`/`serviceId`, never `CustomerEntity`/`PropertyEntity`/`ServiceEntity`. `modules/dashboard` queries other modules' **application-layer** read contracts (not their GraphQL resolvers, and never their TypeORM repositories). This is the rule most likely to erode under time pressure — it's called out explicitly so violations are a conscious exception, not a silent default.

## 3. Web Architecture & Testing

**apps/web** (Next.js, App Router): routes mirror module boundaries — `/customers`, `/cleaners`, `/catalog`, `/bookings`, `/jobs`, `/quality`, `/admin` (staff/roles), `/` as the Operations Dashboard once M8 exists (redirects to the first available module before then). Route-group-level authentication checks the authenticated session/JWT claims available to `apps/web`; authorization semantics mirror the six-role matrix defined by `platform/auth`, but `apps/web` does not depend on `apps/api`'s Nest infrastructure directly. The API (`platform/auth`) remains the authoritative enforcement point — frontend route protection is UX/security layering, not the source of authorization truth. Unauthorized requests redirect to `/login`. Every screen goes through `packages/client` for data and `packages/ui` for components — no screen hand-rolls its own query string or button.

**Testing**: each module gets unit tests for its `application/` layer (mirroring the existing `bookings/tests/` structure) and one e2e spec covering its primary GraphQL workflow end-to-end — not exhaustive field-by-field coverage. `platform/auth` and `platform/audit` get their own unit tests as shared infrastructure. Frontend testing in Phase 1 is manual verification against each milestone's golden path; no browser-automation test suite is being added yet (revisit if regressions start recurring).

## 4. Phase-1 Milestones

| Milestone | Epic | Outcome |
|---|---|---|
| M1 | Admin Foundation | Secure admin shell + auth/RBAC + audit foundation |
| M2 | Customers & Properties | Customer/property workflow end-to-end |
| M3 | Cleaners & Teams | Workforce workflow end-to-end |
| M4 | Catalog | Services/add-ons/pricing workflow |
| M5 | Bookings | Real relational booking workflow |
| M6 | Jobs & Checklists | Booking → job → checklist execution |
| M7 | Quality & Re-cleans | Issue → re-clean → resolution |
| M8 | Operations Dashboard | Cross-domain operational read model |

Audit is cross-cutting and has no standalone Phase-1 backlog issue or milestone. Its infrastructure is built in M1 and exercised by every subsequent milestone's mutations.

Dependency order: M1 unblocks all business modules (nothing is exposed without auth). M2, M3, M4 have no dependencies on each other and can be built in any order once M1 exists. M5 depends on M2–M4. M6 depends on M5 and M3 (jobs need bookings and teams). M7 depends on M6. M8 depends on all of M2–M7.

## 5. Vertical-Slice Definition of Done

> A Phase-1 milestone is complete only when its primary business workflow is executable end-to-end through domain, application, infrastructure, presentation, and web UI, with automated tests covering the relevant behavior.

Example for M2:

```text
Create Customer → Create Property → Persist → API → GraphQL → Web UI → Tests
```

A milestone is not "done" because its entity and API exist — the web UI and the golden-path test have to work too.

## 6. GitHub Backlog Plan

### 6.1 Phase-1 Issues

One issue per vertical slice (module), attached to its milestone (M1–M8). 8 issues total for Phase 1. Each issue body includes a checklist of its layers (domain → application → infrastructure → GraphQL → web UI → tests) as sub-steps, not separate issues.

### 6.2 Deferred Roadmap Issues

One lightweight issue per deferred epic (Locations, Payments, Communication, Notifications, Recurring/Subscriptions, Reporting, Admin Config, Customer Portal, Commercial, Airbnb, Platform Infra) — 11 issues. Labeled `roadmap`, no milestone, no implementation breakdown. Body preserves the original scope bullets from the initial product brainstorm, prefixed with:

> This is a roadmap placeholder. Detailed scope, architecture, dependencies, acceptance criteria, and implementation plan will be determined in a dedicated discovery/design pass when this epic enters prioritization.

## 7. Non-goals

- No full schema-first migration for all Phase-1 domains — schema evolves per milestone, in dependency order (§4).
- No premature implementation of deferred roadmap epics (§6.2).
- No standalone Property module in Phase 1 (§8).
- No domain model or persistence for Operations Dashboard — it's a read layer only (§2.4).
- No direct cross-module infrastructure/repository access (§2.6).
- No generic shared domain abstractions created solely to reduce duplication.
- No dashboard-specific persistence/read model unless a real performance need later justifies it.
- No redesign of the existing Booking REST contract — it's preserved as a reference implementation, not extended to new modules (all new modules are GraphQL-only).
- No browser-automation test suite for apps/web in Phase 1.

## 8. Future Evolution / Extraction Triggers

Documented in advance so these decisions are evidence-driven later, not re-litigated from scratch:

- **Property → standalone module**: extract when properties gain independent lifecycles not owned by a single Customer — e.g. property managers, Airbnb accounts, or commercial accounts referencing the same property across multiple customer relationships (ties into the deferred Commercial and Airbnb/Property Management epics).
- **Dashboard read model**: introduce a dedicated read model / materialized view only if cross-module application-layer queries become a measured performance problem — not preemptively.
- **Commercial and Airbnb as distinct bounded contexts**: split from `customers`/`bookings`/`catalog` if/when those epics are prioritized and their workflows are shown to diverge meaningfully from residential (different contract structures, multi-contact accounts, turnover-based scheduling).
- **`packages/domain`, `packages/auth`, `packages/config`, `packages/testing`**: extract only once a second consumer (e.g. `apps/worker`) actually needs to share that code — not before.
- **`apps/worker`**: introduced when background/async work (reminders, notifications, payment reconciliation) is actually prioritized — none of that is in Phase 1.
