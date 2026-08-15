# Admin Foundation: Auth, RBAC, Staff Accounts, Audit Infrastructure — Specification

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Kind** | Architecture RFC (product behavior/contracts for this slice, not a process specification) |
| **Date** | 2026-08-14 |
| **Tracking** | [#1](https://github.com/rexescario-dev/clensy-platform/issues/1) (milestone M1 — Admin Foundation) |
| **Depends on (informative)** | [Phase 1 Design](2026-08-14-clensy-platform-phase1-design.md) §2.2 (platform), §2.3 (admins row), §4 (M1), §5 (vertical-slice DoD) — reviewed and approved by the project owner across several rounds, but predates this repository's `docs/workflows/` install and was never formally Accepted through this process's M3 gate. Cited here as background architecture context, not as a formally Accepted upstream artifact. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M2 |
| **Revision note** | First draft was returned at M3: the component/boundary architecture was accepted in spirit, but several security- and behavior-sensitive contracts were left implicit (RBAC matrix, JWT/principal semantics, disabled-account behavior, `@Roles()` semantics, staff lifecycle edge cases, audit semantics, web session mechanism, GraphQL operation surface, `@CurrentUser()` type, dependency direction). That revision resolved each one normatively. A second, smaller M3 pass Accepted the result with 5 targeted corrections (cookie-presence-as-UX-hint-only, cookie lifetime bound, non-discriminating failed-login audit reason, an added disabled-JWT e2e step, "role management" → "staff account management" terminology) — applied in this version. |
| **M3 decision** | **Accepted** — 2026-08-14. No remaining architectural blocker; corrections above applied. Ready for M4 Implementation Planning. |

## 1. Primary question & thesis

**Question:** What is the secure admin shell that every other Phase-1 module depends on for authentication, authorization, and traceability — and what exactly does it own versus defer?

**Thesis:** Admin Foundation ships three cleanly separated pieces — `platform/auth` (how a request is authenticated and authorized), `modules/admins` (who staff are), and `platform/audit` (what happened) — plus the `apps/web` login/admin screens and route-group auth gate. No Phase-1 business GraphQL operation is reachable without authentication (and, where declared, authorization) established by this slice — except explicitly designated public/system endpoints (in this slice: the `login` mutation itself; infrastructure-level endpoints such as a health check are not GraphQL business operations and are out of scope for this RFC).

## 2. Scope

### In scope (normative)

- `platform/auth`: Passport JWT strategy, `AuthGuard`, `@Roles()` / `@CurrentUser()` decorators, fixed 6-role enum (Owner, Operations Manager, Scheduler, Customer Support, Finance, Read-only Analyst) and the M1 permission matrix defined in §4.5.
- `platform/audit`: `AuditEvent` entity, `AuditLogger` port with a single call contract (`audit.log({ actorId, action, entityType, entityId, metadata })`) usable from any module's application layer.
- `modules/admins`: `AdminUser` and `Role` domain objects, login use case, staff account **lifecycle**: create, list, disable (not full CRUD — there is no update or delete operation in this slice).
- `apps/web`: `/login`, `/admin` (staff account management and role assignment, Owner-only per §4.5), route-group-level auth gate covering every other route.
- GraphQL presentation per the operation surface in §4.9.
- Tests: unit coverage for `platform/auth` guard/RBAC logic, `platform/audit` logger, `modules/admins` application layer; e2e per §4.10 acceptance flow.

### Out of scope (normative)

- Any other Phase-1 module's domain logic (customers, cleaners, catalog, bookings, jobs, quality, dashboard) — those are separate milestones/issues, each of which declares its own `@Roles()` requirements against the fixed enum from this slice (§4.5).
- OAuth/SSO, social login, or any identity provider beyond email+password against `AdminUser`.
- Password reset / forgot-password email flows.
- Refresh-token rotation, multi-device session management, or token revocation lists beyond the JWT expiry defined in §4.1.
- Per-resource or per-record ACLs — authorization is role-based only, against the fixed 6-role matrix.
- Staff account update (e.g. changing an existing account's role or email) — only create, list, and disable exist in this slice. Role is fixed at creation time.
- Multi-tenancy of any kind.
- Customer-facing authentication (customers are not `AdminUser`s and are out of scope entirely until their own module milestone).
- An audit-log viewing UI — this slice records audit events; browsing/reporting on them is deferred until a consuming module (e.g. the Operations Dashboard, M8) needs it.
- Everything already declared roadmap in the Phase 1 design (§7 non-goals there still holds).

## 3. Terminology

- **AdminUser** — a `modules/admins` domain object representing a staff member who can authenticate; owns identity (email, credential hash), a `Role`, and an `isActive` flag.
- **Role** — one of the fixed 6-role enum: Owner, Operations Manager, Scheduler, Customer Support, Finance, Read-only Analyst. Not user-definable in Phase 1.
- **AuthenticatedPrincipal** — the value `platform/auth` exposes for the current request: `{ id: string; role: Role }`. Distinct from `AdminUser` — see §4.7.
- **Actor** — the `AuthenticatedPrincipal` performing an action, threaded into `platform/audit` calls as `actorId`. May be absent (`null`) for events with no authenticated actor (e.g. a failed login).
- **AuditEvent** — an immutable record of `{ actorId, action, entityType, entityId, metadata, occurredAt }`.
- **AuthGuard** — the NestJS guard in `platform/auth` that verifies a request's authentication and, when the resolver declares `@Roles(...)`, its authorization.
- **RBAC** — role-based access control against the fixed 6-role matrix; enforced by `@Roles()` + `AuthGuard`, not by any per-module custom logic.

## 4. Security and behavioral contracts

### 4.1 Authentication principal and JWT

- The JWT contains only `sub` (the `AdminUser.id`), `iat`, and `exp`. It does **not** carry a `role` claim.
- `AuthGuard` verifies the JWT's signature and expiry, then loads the current `AdminUser` from the database by `sub` **on every request**. The role and active-status used for the request's authorization decision are always the current database values: the authorization decision MUST NOT use a cached `AdminUser` representation or role/status value, and MUST NOT be trusted from the token. This is a deliberate choice for a low-volume internal tool: correctness (no stale-permission window) is worth the per-request lookup.
- A request is **authenticated** only when both hold: (a) the JWT is validly signed and unexpired, and (b) the `AdminUser` identified by `sub` currently exists and `isActive = true`. If either fails, the request is treated as unauthenticated — including the case where the account was disabled after the JWT was issued (the account's current `isActive` flag governs, not the token's remaining validity window).
- JWT expiry is 8 hours from issuance. There is no revocation list in this slice (out of scope, §2); an admin who needs to force out a disabled user relies on the disabled-account check in the bullet above, which takes effect on the disabled user's very next request.

### 4.2 `@Roles()` semantics

- `AuthGuard` alone (no `@Roles(...)`) requires authentication only — any currently-active `AdminUser`, regardless of role, may call the operation.
- `@Roles(RoleA, RoleB, ...)` requires authentication **and** that the current principal's role is one of the listed roles (**OR** semantics across multiple roles).
- Every non-public Phase-1 GraphQL operation MUST require authentication (`AuthGuard`). Operations requiring a restricted capability MUST additionally declare `@Roles(...)`. In this slice, `login` is the only public operation (§4.9); everything else requires at least authentication.

### 4.3 Login behavior

- `login(email, password)` is public (no `AuthGuard`).
- Email is normalized to lowercase for both storage and lookup (case-insensitive).
- Unknown email, wrong password, and disabled account all return the **same** generic error (`invalid credentials`) — the response MUST NOT let a caller distinguish "no such account" from "wrong password" from "disabled," to prevent account enumeration.
- Passwords are hashed with a modern, salted, adaptive algorithm (e.g. bcrypt or argon2 — the specific library is an M4 choice). Plaintext passwords MUST NOT be persisted, logged, or included in audit `metadata` under any circumstance.
- On success: issue a JWT per §4.1, set it via the web cookie mechanism in §4.8, and record `admin.login.succeeded` (§4.6).
- On failure (any reason): record `admin.login.failed` (§4.6) with `actorId: null` — failures happen before authentication, so there is no principal to attribute them to.

### 4.4 Staff lifecycle edge cases

- An actor MUST NOT disable their own account.
- The system MUST NOT allow disabling the last active Owner account (i.e. a disable request that would bring the count of active Owner accounts to zero MUST be rejected). This prevents an administratively unrecoverable state. An Owner MAY disable another Owner, provided at least one active Owner remains afterward.
- Only the Owner role may create, list, or disable staff accounts (§4.5) — role assignment therefore only ever happens at creation time, performed by an Owner, and there is no later role-change operation to reason about in this slice.

### 4.5 M1 permission matrix

This slice implements exactly one gated capability: staff account management (including role assignment at creation — there is no separate role-management operation, since roles are only ever set when an account is created). Every other capability row a future matrix might contain (booking management, catalog management, etc.) belongs to the module that implements it, declared in that module's own specification against this same 6-role enum — this RFC does not pre-assign permissions for modules that do not exist yet.

| Capability | Owner | Ops Manager | Scheduler | Customer Support | Finance | Analyst |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Staff account management (create / list / disable; role assignment at creation) | ✓ | | | | | |
| Authenticate (`login`) and hold a session | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Non-Owner roles authenticate successfully in this slice but have no functional destination beyond that until their own module milestone ships a UI/capability for them — expected and correct for a foundation slice, not a gap.

### 4.6 Audit event semantics

- `action` is a free-form, namespaced string (e.g. `admin.created`), not a global enum — this keeps the taxonomy extensible as later modules add their own actions without touching `platform/audit`.
- `entityType` and `entityId` are both nullable — some events (e.g. a failed login) have no specific entity to attribute.
- `metadata` MUST be a JSON-serializable plain object. It MUST NOT contain credentials, password hashes, authentication tokens, or other secrets under any circumstance.
- Minimum required M1 events: `admin.created` (actor = creating Owner, entity = new `AdminUser`, metadata includes the assigned role), `admin.disabled` (actor = disabling Owner, entity = disabled `AdminUser`), `admin.login.succeeded` (actor = the `AdminUser`, entity = same), `admin.login.failed` (actor = `null`, entity = `null`, metadata includes the attempted email and a fixed, non-discriminating `reason: "invalid_credentials"` value — never the specific cause from §4.3's indistinguishable-error list (unknown email vs wrong password vs disabled), to avoid leaking enumeration information through the audit trail itself. The attempted email in `metadata` is data about the attempt, not an actor identity — `actorId` remains `null` regardless).
- Audit events accompanying a state-changing operation (`admin.created`, `admin.disabled`) MUST be persisted within the same database transaction as the state change they describe: if the transaction rolls back, no audit event exists for it, and a failure to write the audit event rolls back the state change with it. Audit events with no accompanying state change (`admin.login.succeeded`, `admin.login.failed`) are persisted as an ordinary write; a failure to persist one of these MUST NOT block the outcome it describes (a login MUST still succeed even if its audit write fails), but MUST be observable through the application's error logging/monitoring mechanism.
- `AuditEvent` MUST expose no application-level update or delete operation — audit persistence is write-only from the application services that emit events (database-level append-only enforcement, if any, is an M4/M6 implementation choice, not required here).

### 4.7 `@CurrentUser()` type

`@CurrentUser()` returns an `AuthenticatedPrincipal` (`{ id, role }`, §3) — never `modules/admins`' `AdminUser` domain object directly. This keeps `platform/auth` from leaking `modules/admins`' domain shape into every other module's resolvers that consume `@CurrentUser()`.

### 4.8 Web session mechanism

The web authentication contract is an **HttpOnly, Secure, SameSite=Lax cookie**, set by the `login` mutation's response — not a bearer token in `localStorage` or otherwise exposed to browser JavaScript, to avoid exposing the JWT to XSS. The API's response to `login` is responsible for setting this cookie; the browser MUST send it with subsequent GraphQL requests. The cookie's lifetime MUST NOT exceed the JWT's 8-hour expiry (§4.1); exact `Max-Age`/`Expires` mechanics are an M4 decision.

`apps/web`'s route-group middleware MAY use the cookie's presence only as a routing/UX hint to redirect obviously unauthenticated requests to `/login`; it MUST NOT treat cookie presence as proof of authentication, and MUST NOT make authorization decisions from it, nor independently decode or trust the JWT's claims. The GraphQL API (`platform/auth`) remains the sole authentication and authorization authority, per the Phase 1 design's web-auth boundary — this section makes that boundary's "session/JWT claims" phrasing concrete for this slice: route middleware is a UX-level gate only; API authentication is authoritative.

### 4.9 GraphQL operation surface

```text
Mutation
  login(email, password)       — public
  createAdmin(...)              — Owner only
  disableAdmin(id)              — Owner only

Query
  currentAdmin                  — authenticated (any role)
  admins                        — Owner only
```

Exact input/output SDL shapes are an M4 decision; this RFC fixes the operation names, their public/authenticated/role-gated status, and that no other admin-management operations exist in this slice. `currentAdmin` returns the current authenticated principal/account representation and MUST NOT expose credential hashes or other authentication secrets.

### 4.10 E2E acceptance flow

The required e2e MUST exercise both authentication and authorization, not authentication alone:

1. Log in as Owner → `createAdmin` succeeds (a Scheduler account, say) → `admin.created` audit event recorded.
2. Log in as that new Scheduler → `createAdmin` is denied (role check, not just auth check) → `disableAdmin` is denied.
3. Log in as Owner → `disableAdmin(schedulerId)` succeeds → `admin.disabled` audit event recorded.
4. A failed login attempt records `admin.login.failed` with no actor.
5. The disabled Scheduler's previously issued JWT/cookie is rejected on its next protected request — proving §4.1's DB-authoritative status check actually takes effect, not merely that a fresh login is required.

## 5. Invariants and boundaries (MUST / MUST NOT)

1. `platform/auth` MUST own *how* a request is authenticated and authorized (JWT verification, role check per §4.1–§4.2). `modules/admins` MUST own *who* staff are (identity, account lifecycle). Neither MUST duplicate the other's responsibility.
2. `platform/auth` MUST NOT depend on `modules/admins`' concrete persistence/infrastructure layer. It MUST depend on an abstraction it owns (an admin-identity-lookup port, e.g. `findActiveAdminById(id): AuthenticatedPrincipal | null`), which `modules/admins` implements. The exact interface shape is an M4 decision; this specification fixes only the dependency direction, matching the cross-module dependency rule already locked in the Phase 1 design.
3. `AuditLogger` is an application-facing port (`log(event): Promise<void>`) that `platform/audit` implements. Calling modules depend on the port/injection token, not on `platform/audit`'s concrete persistence implementation. Modules MUST NOT write directly to the `AuditEvent` table — they own no persistence access to it.
4. The 6-role enum is fixed for Phase 1. This specification MUST NOT introduce role hierarchy, custom roles, or per-resource permission overrides beyond §4.5's matrix — that is out of scope (§2) and would contradict the already-locked Phase 1 decision.
5. Every non-public Phase-1 GraphQL operation MUST require authentication; operations needing a restricted capability MUST additionally declare `@Roles(...)` (§4.2). This is the mechanism every later milestone's module MUST use to gate its own resolvers — this slice is a hard dependency for all of them.
6. `apps/web` route-group auth middleware MAY use the session cookie's presence (§4.8) only as a routing/UX hint; it MUST NOT depend on `apps/api`'s NestJS internals directly, and MUST NOT itself make authorization decisions — those belong solely to the API.
7. This module MUST NOT implement anything listed in §2 out-of-scope, even if trivial to add while "already in the file."

## 6. Rationale

- **`platform/auth` vs `modules/admins` split:** authentication/authorization is cross-cutting infrastructure every module needs (a `platform/` concern), while staff identity/lifecycle is a business concern with its own CRUD-like operations and eventually its own reporting — keeping them separate, with `platform/auth` depending on an abstraction rather than `modules/admins` directly (§5.2), lets the security boundary stay stable even as `modules/admins` grows.
- **DB-authoritative role/status on every request, no role in the JWT (§4.1):** an internal ops tool at this scale doesn't need stateless-JWT-at-all-costs; correctness around disabled accounts and role changes matters more than avoiding one indexed lookup per request.
- **HttpOnly cookie over localStorage (§4.8):** an admin panel is exactly the kind of surface where XSS-exfiltrated bearer tokens are highest-consequence; a cookie the client can't read removes that attack surface entirely.
- **Fixed roles, single M1 capability (§4.5):** already decided at the Phase 1 architecture level for the roles themselves; this RFC adds only what M1 actually implements (staff account management, Owner-only) rather than inventing permissions for modules that don't exist yet — future modules declare their own rows against the same enum when they're specified.
- **Transactional audit for state changes, best-effort-but-logged for login events (§4.6):** state-changing operations (staff create/disable) need audit and state to be atomic for compliance value; login events don't have an accompanying state mutation to be atomic with, so blocking a login on an audit-write failure would trade availability for a guarantee that doesn't actually exist for that event type.
- **`AuditLogger` and the admin-identity lookup as ports, not concrete imports (§5.2–§5.3):** keeps this specification consistent with the project's existing preference for dependency inversion at module boundaries, and prevents `platform/auth` and calling modules from hard-coupling to implementation details that may change.

## 7. Acceptance criteria (for this specification)

1. Scope boundary (§2) is unambiguous enough that M4 planning does not need to invent what's in vs out.
2. §4's contracts (JWT/principal, `@Roles()`, login, staff lifecycle edge cases, the M1 permission matrix, audit semantics, `@CurrentUser()` type, web session mechanism, GraphQL surface, e2e flow) are concrete enough that an M4 implementer does not have to make a security-sensitive product decision on their own.
3. Invariants (§5) are specific enough to review-gate M6 implementation against.
4. The `platform/auth` / `modules/admins` / `platform/audit` three-way split, its dependency directions, and its rationale are clear enough for M3 to Accept or return with a concrete objection.
5. No section contradicts the Phase 1 design doc's existing architecture decisions (§2.2, §2.3, §4, §5) — this document narrows and operationalizes that context for the M1 slice, it does not redesign it.
6. Terminology (§3) is sufficient for M4 to write commands/queries without inventing naming.

## 8. Non-goals (of this specification)

- Design Review decisions — this document does not self-Accept; M3 decides.
- Implementation planning, task breakdown, or file-level decomposition (M4).
- Any implementation activity (M6).
- Redesigning the already-locked Phase 1 architecture (module boundaries, stack choices, milestone sequence) — those stand as reviewed.
- Pre-assigning permissions for modules beyond Admin Foundation (§4.5) — each module's own specification owns that.
