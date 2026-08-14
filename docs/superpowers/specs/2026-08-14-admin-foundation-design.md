# Admin Foundation: Auth, RBAC, Staff Accounts, Audit Infrastructure — Specification

| Field | Value |
| --- | --- |
| **Status** | Draft |
| **Kind** | Architecture RFC (product behavior/contracts for this slice, not a process specification) |
| **Date** | 2026-08-14 |
| **Tracking** | [#1](https://github.com/rexescario-dev/clensy-platform/issues/1) (milestone M1 — Admin Foundation) |
| **Depends on (informative)** | [Phase 1 Design](2026-08-14-clensy-platform-phase1-design.md) §2.2 (platform), §2.3 (admins row), §4 (M1), §5 (vertical-slice DoD) — reviewed and approved by the project owner across several rounds, but predates this repository's `docs/workflows/` install and was never formally Accepted through this process's M3 gate. Cited here as background architecture context, not as a formally Accepted upstream artifact. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M2 |
| **Followed by** | M3 Design Review |

## 1. Primary question & thesis

**Question:** What is the secure admin shell that every other Phase-1 module depends on for authentication, authorization, and traceability — and what exactly does it own versus defer?

**Thesis:** Admin Foundation ships three cleanly separated pieces — `platform/auth` (how a request is authenticated and authorized), `modules/admins` (who staff are), and `platform/audit` (what happened) — plus the `apps/web` login/admin screens and route-group auth gate. Nothing else in Phase 1 is reachable without this slice; it is the first milestone for exactly that reason.

## 2. Scope

### In scope (normative)

- `platform/auth`: Passport JWT strategy, `AuthGuard`, `@Roles()` / `@CurrentUser()` decorators, fixed 6-role permission matrix (Owner, Operations Manager, Scheduler, Customer Support, Finance, Read-only Analyst).
- `platform/audit`: `AuditEvent` entity, `AuditLogger` service with a single call contract (`audit.log({ actorId, action, entityType, entityId, metadata })`) usable from any module's application layer.
- `modules/admins`: `AdminUser` and `Role` domain objects, login use case, staff account CRUD (create / list / disable).
- `apps/web`: `/login`, `/admin` (staff/role management), route-group-level auth middleware gating every other route.
- GraphQL presentation for staff CRUD + login mutation.
- Tests: unit coverage for `platform/auth` guard/RBAC logic, `platform/audit` logger, `modules/admins` application layer; one e2e covering login → access a protected query → audit event recorded.

### Out of scope (normative)

- Any other Phase-1 module's domain logic (customers, cleaners, catalog, bookings, jobs, quality, dashboard) — those are separate milestones/issues.
- OAuth/SSO, social login, or any identity provider beyond email+password against `AdminUser`.
- Password reset / forgot-password email flows.
- Refresh-token rotation, multi-device session management, or token revocation lists beyond a basic JWT expiry.
- Per-resource or per-record ACLs — authorization is role-based only, against the fixed 6-role matrix (already locked in the Phase 1 design; not re-litigated here).
- Multi-tenancy of any kind.
- Customer-facing authentication (customers are not `AdminUser`s and are out of scope entirely until their own module milestone).
- Everything already declared roadmap in the Phase 1 design (§7 non-goals there still holds).

## 3. Terminology

- **AdminUser** — a `modules/admins` domain object representing a staff member who can authenticate; owns identity (email, credential hash) and a `Role`.
- **Role** — one of the fixed 6-role enum: Owner, Operations Manager, Scheduler, Customer Support, Finance, Read-only Analyst. Not user-definable in Phase 1.
- **Actor** — the authenticated `AdminUser` performing an action, as attached to a request by `platform/auth` and threaded into `platform/audit` calls.
- **AuditEvent** — an immutable record of `{ actorId, action, entityType, entityId, metadata, occurredAt }`.
- **AuthGuard** — the NestJS guard in `platform/auth` that verifies a JWT and attaches the authenticated actor + role to the request context.
- **RBAC** — role-based access control against the fixed 6-role matrix; enforced by `@Roles()` decorator + `AuthGuard`, not by any per-module custom logic.

## 4. Invariants and boundaries (MUST / MUST NOT)

1. `platform/auth` MUST own *how* a request is authenticated and authorized (JWT verification, role check). `modules/admins` MUST own *who* staff are (identity, account lifecycle). Neither MUST duplicate the other's responsibility.
2. `platform/audit` MUST be callable from any module's application layer via the single `audit.log(...)` contract. Modules MUST NOT write directly to the `AuditEvent` table — they own no persistence access to it.
3. The 6-role matrix is fixed for Phase 1. This specification MUST NOT introduce role hierarchy, custom roles, or per-resource permission overrides — that is out of scope (§2) and would contradict the already-locked Phase 1 decision.
4. Every other Phase-1 module's GraphQL resolvers MUST sit behind `AuthGuard` + `@Roles()` — this slice is a hard dependency for every later milestone (M2–M8), consistent with the Phase 1 design's dependency ordering.
5. `apps/web` route-group auth middleware MUST check the authenticated session/JWT claims available to it; it MUST NOT depend on `apps/api`'s NestJS internals directly. `platform/auth` on the API side remains the authoritative enforcement point (per Phase 1 design's web auth boundary, carried forward unchanged here).
6. `AuditEvent` records MUST be immutable after write — no update/delete path in this slice.
7. This module MUST NOT implement anything listed in §2 out-of-scope, even if trivial to add while "already in the file."

## 5. Rationale

- **`platform/auth` vs `modules/admins` split:** authentication/authorization is cross-cutting infrastructure every module needs (a `platform/` concern per the Phase 1 layout), while staff identity/lifecycle is a business concern with its own CRUD and eventually its own reporting — keeping them separate lets `platform/auth`'s contract stay stable even if `modules/admins` grows (e.g. staff scheduling metadata, future HR fields) without touching the security boundary.
- **Fixed roles, not a role builder:** already decided at the Phase 1 architecture level; re-affirmed here because this is the slice that would be tempted to over-build a permissions UI. A fixed enum is sufficient for a single internal operations tool with six known job functions, and a role-management UI is explicitly deferred (roadmap issue #15, Admin Configuration).
- **`platform/audit` as a single-call service, not per-module logging:** every module needs traceability for compliance/debugging reasons that have nothing to do with their own domain logic; centralizing it avoids six different ad-hoc audit implementations and gives the eventual Operations Dashboard (M8) one place to read from later, if that need arises (not committed here — dashboard remains out of scope for this slice).

## 6. Acceptance criteria (for this specification)

1. Scope boundary (§2) is unambiguous enough that M4 planning does not need to invent what's in vs out.
2. Invariants (§4) are specific enough to review-gate M6 implementation against.
3. The `platform/auth` / `modules/admins` / `platform/audit` three-way split and its rationale are clear enough for M3 to Accept or return with a concrete objection.
4. No section contradicts the Phase 1 design doc's existing architecture decisions (§2.2, §2.3, §4, §5) — this document narrows and operationalizes that context for the M1 slice, it does not redesign it.
5. Terminology (§3) is sufficient for M4 to write commands/queries without inventing naming.

## 7. Non-goals (of this specification)

- Design Review decisions — this document does not self-Accept; M3 decides.
- Implementation planning, task breakdown, or file-level decomposition (M4).
- Any implementation activity (M6).
- Redesigning the already-locked Phase 1 architecture (module boundaries, stack choices, milestone sequence) — those stand as reviewed.
