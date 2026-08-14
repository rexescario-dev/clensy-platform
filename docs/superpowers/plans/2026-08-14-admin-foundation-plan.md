# Admin Foundation: Implementation Plan

| Field | Value |
| --- | --- |
| **Status** | Draft (revised after M5 return) |
| **Date** | 2026-08-14 |
| **Tracking** | [#1](https://github.com/rexescario-dev/clensy-platform/issues/1) (milestone M1 — Admin Foundation) |
| **Package/repo scope** | `apps/api` (new: `platform/auth`, `platform/audit`, `modules/admins`; modified: `app/app.module.ts`, `platform/database/data-source.ts`, `main.ts`, `.env.example`, `package.json`); `apps/web` (bootstrap + `/login`, `/admin`); `packages/client`, `packages/ui` (bootstrap, minimal) |
| **Depends on (Accepted)** | [Admin Foundation Specification](../specs/2026-08-14-admin-foundation-design.md) — Status: Accepted, 2026-08-14 |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M4 |
| **Revision note** | First plan was returned at M5 for a circular contract dependency, a leaked `EntityManager` parameter, wrong module-import direction, and several under-specified operational details — all resolved (auth split into contracts + implementation, single-method `AuditLogger`, composition-root wiring). A second M5 pass tightened cross-origin cookie mechanics (CORS, Apollo credentials, `Secure`-on-`localhost`, explicit login orchestration order). A third M5 pass (self-review) found a genuine correctness bug the first two rounds missed: the last-active-Owner check was specified to run *before* the transaction, a check-then-act race that could let concurrent disable requests leave zero active Owners — moved inside the transaction behind a locking read. Also added an explicit unique constraint on `email` (§4.3's login-by-email step is only well-defined if accounts can't share one) and fixed two ambiguous section citations. |
| **Followed by** | M5 Plan Review (re-review) |

Where this plan and the Accepted specification disagree, the specification wins and this plan must be revised.

## 1. Delivery intent

Implement exactly what the Accepted specification authorizes: `platform/auth` (JWT verification, `AuthGuard`, `@Roles()`/`@CurrentUser()`), `platform/audit` (`AuditEvent`, `AuditLogger` port), `modules/admins` (`AdminUser`, `Role`, login, staff lifecycle), the GraphQL operation surface in spec §4.9, and the `apps/web` `/login` + `/admin` screens with route-group middleware. Not a redesign of any of it.

## 2. Planning-time finding — flagged, not a design gap

`apps/web`, `packages/client`, and `packages/ui` currently contain no framework scaffolding — no Next.js app, no Apollo Client setup, no components (each is an empty `package.json` + `src/index.ts` stub). The Accepted spec correctly doesn't need to say this (framework bootstrapping is an M4/M6 concern, not product semantics), but it materially affects this slice's size: Admin Foundation is also the *first* web-facing slice for the whole product. Task 7 below is **infrastructure bootstrap, not a feature task** — it does not attempt a general-purpose app shell beyond what `/login` and `/admin` need.

## 3. Constraints (SHALL / SHALL NOT, derived only from the Accepted spec)

**SHALL** (traced to spec section):
- JWT contains only `sub`, `iat`, `exp` — no `role` claim (§4.1).
- `AuthGuard` loads the current `AdminUser` from the database on every request; authorization uses only that fresh read (§4.1).
- JWT expiry is 8 hours (§4.1).
- The JWT is extracted from the named session cookie (§4.8), never from an `Authorization: Bearer` header — this slice does not introduce bearer-token authentication.
- Application startup MUST fail (not silently default) if `JWT_SECRET` is missing outside test environments — no `process.env.JWT_SECRET || 'fallback'` pattern.
- `@Roles(...)` uses OR semantics; `AuthGuard` alone means authenticated-only (§4.2).
- `login` is public; all other operations require at least `AuthGuard` (§4.2, §4.9).
- Login errors (unknown email / wrong password / disabled) are indistinguishable (§4.3).
- Passwords hashed with a modern salted adaptive algorithm; never persisted/logged/audited in plaintext (§4.3).
- An actor MUST NOT disable their own account; the last active Owner MUST NOT be disabled; an Owner MAY disable another Owner if one remains active (§4.4).
- Only Owner may create/list/disable staff accounts (§4.4, §4.5 matrix).
- The `AuditLogger` public contract is exactly `log(event): Promise<void>` — no persistence-mechanism parameter (e.g. `EntityManager`) on the public port (§4.6, §5.3).
- `action` free-form namespaced string; `entityType`/`entityId` nullable; `metadata` MUST NOT contain secrets and MUST be JSON-serializable (§4.6).
- Minimum M1 audit events: `admin.created`, `admin.disabled`, `admin.login.succeeded`, `admin.login.failed` (§4.6).
- State-changing audit writes (`admin.created`, `admin.disabled`) share a transaction with the state change, observed as: if the audit write fails, the state change does not persist either. The transaction boundary is owned by `modules/admins`' application service; how `AuditLogger`'s implementation participates in that ambient transaction is an M6 mechanism, not part of its public contract. Login-event audit writes never block the login outcome, but failures must be observable via error logging (§4.6).
- `AuditEvent` has no update/delete path — write-only from emitting services (§4.6).
- Audit events are inspected in tests via direct database/repository access only — no GraphQL query exposes them (§4.9 fixes the operation surface at 5 operations; audit querying is not one of them).
- `@CurrentUser()` returns `AuthenticatedPrincipal { id, role }`, never the `AdminUser` domain object (§4.7, §5.1).
- `platform/auth` depends on an admin-identity-lookup abstraction it owns; `modules/admins` implements it — `platform/auth` MUST NOT import `modules/admins`' persistence layer, and MUST NOT import `AdminsModule` at all (§5.2; §9 below fixes the composition-root wiring pattern instead).
- Session mechanism: HttpOnly + Secure + SameSite=Lax cookie set by `login`'s response; cookie lifetime ≤ 8h; web middleware treats cookie presence as a routing hint only, never as authentication/authorization proof (§4.8, §5.6).
- GraphQL surface is exactly: `login`, `createAdmin`, `disableAdmin`, `currentAdmin`, `admins` — no others (§4.9). `currentAdmin` MUST NOT expose credential hashes; it may expose other safe staff profile fields and is not required to match `AuthenticatedPrincipal`'s shape exactly.
- GraphQL object types are explicitly-defined presentation types — domain interfaces and TypeORM entities MUST NOT be used directly as GraphQL types (prevents accidental field leakage, e.g. `passwordHash`).
- E2E MUST cover: allowed role operation, denied role operation, denied disabled-JWT reuse, audit events recorded (§4.10).

**SHALL NOT** (explicit spec/design non-goals — do not invent):
- No OAuth/SSO, password reset, refresh-token rotation, revocation list (spec §2).
- No staff account update or delete — create/list/disable only (spec §2, §4.4).
- No per-resource ACLs, role hierarchy, or custom roles beyond the fixed 6 (spec §2, §5.4).
- No audit-log viewing UI or GraphQL query (spec §2; SHALL list above).
- No code in `packages/domain`, `packages/auth`, `packages/config`, `packages/testing` — the Phase 1 design defers those extractions until a second consumer needs the shared code; `apps/api` is Admin Foundation's only consumer (Phase 1 design §"packages/domain, packages/auth, packages/config, packages/testing" note). This plan is a planning decision applying that already-Accepted-in-spirit constraint, not a new one.
- No permissions for modules that don't exist yet (spec §4.5, §8).

## 4. Implementation decisions (M4 choices, not spec-derived)

The spec deliberately leaves these open; this plan fixes them for M6 so no implementer has to choose alone:

- Password hashing: **bcrypt** (`bcrypt` + `@types/bcrypt`).
- JWT issuance/verification: `@nestjs/jwt` + `passport-jwt` (Passport strategy), with a custom cookie extractor rather than the library's default bearer-header extractor.
- Cookie parsing: `cookie-parser` middleware, needed both for the JWT strategy's cookie extractor to read `req.cookies` and for consistency with how the cookie is set.
- Web framework: Next.js (App Router).
- GraphQL client: Apollo Client, with `@graphql-codegen` generating typed hooks from `apps/api`'s schema.
- Metadata type: `Record<string, JsonValue>` (a small local `JsonValue` union: `string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }`), not `Record<string, unknown>` — gives the "must be JSON-serializable" constraint a compile-time approximation.
- Transaction-participation mechanism for `AuditLogger` (how the implementation observes the ambient transaction `modules/admins` opens): left to M6 to choose (e.g. a request/async-local-storage-scoped current-`EntityManager` service, or an injected `EntityManager` at the *implementation* class's construction — never as a parameter on the public `log()` signature).
- Session cookie name: a single named constant (e.g. exported from `platform/auth`'s config), read by both the `login` resolver's cookie-setting code and the JWT strategy's cookie extractor — never two independently-typed string literals that could drift apart.
- `Secure` cookie in local development: modern browsers treat `http://localhost` as a secure context per the W3C Secure Contexts spec, so a `Secure` cookie set by an API on `localhost` is sent correctly by the browser without requiring local HTTPS. This is standard platform behavior this plan relies on, not a workaround — the implementation MUST NOT weaken the cookie to `secure: process.env.NODE_ENV === 'production'` or similar as a dev shortcut. If local dev is ever served from a non-`localhost` hostname, HTTPS must be provisioned (e.g. via `mkcert`) rather than relaxing the flag.
- Cross-origin cookie transport: `apps/api`'s CORS configuration allows credentials (`credentials: true`) scoped to the configured web origin, and `packages/client`'s Apollo Client is configured with `credentials: 'include'` — both required for the browser to send/receive the HttpOnly cookie across the `apps/web` ↔ `apps/api` origin boundary (they run on different ports in local dev). This is the implementation `apps/web`/`apps/api` mechanics required by spec §4.8, not new product behavior.

## 5. Ownership boundaries

| Owns (this slice) | Must remain untouched |
| --- | --- |
| `apps/api/src/platform/auth/**` (new) | `apps/api/src/modules/bookings/**` |
| `apps/api/src/platform/audit/**` (new) | `apps/api/src/platform/graphql/**`, `platform/config/**` (read-only use) |
| `apps/api/src/modules/admins/**` (new) | `packages/domain`, `packages/auth`, `packages/config`, `packages/testing` (no extraction this slice) |
| `apps/api/src/app/app.module.ts` (composition root — registers new modules and wires the identity-lookup binding) | — |
| `apps/api/src/platform/database/data-source.ts` (add new entities) | — |
| `apps/api/src/main.ts` (register `cookie-parser`, enable credentialed CORS) | — |
| `apps/api/package.json`, `.env.example` (new deps/env vars) | — |
| `apps/web/**`, `packages/client/**`, `packages/ui/**` (bootstrap + login/admin only) | Any other Phase-1 module's future screens |

## 6. Contract inventory (only what the Accepted spec authorizes)

- `AuthenticatedPrincipal { id: string; role: Role }` (`platform/auth`)
- `Role` enum: `OWNER | OPS_MANAGER | SCHEDULER | CUSTOMER_SUPPORT | FINANCE | ANALYST` (`platform/auth` — both `platform/auth` and `modules/admins` need it; owning it in `platform/auth` keeps the dependency direction `modules → platform`, not the reverse)
- Admin-identity-lookup port: `findActiveAdminById(id: string): Promise<AuthenticatedPrincipal | null>` (interface + DI token owned by `platform/auth`; implemented by `modules/admins`)
- `AuditLogger` port: `log(event: { actorId: string | null; action: string; entityType: string | null; entityId: string | null; metadata?: Record<string, JsonValue> }): Promise<void>` (owned by `platform/audit`) — this is the **entire** public surface; no second method
- GraphQL: `login`, `createAdmin`, `disableAdmin`, `currentAdmin`, `admins` (spec §4.9)

Exact TypeScript signatures beyond the above (internal service method names, DTO shapes) are implementation detail decided per-task below; the spec does not freeze them further and this plan does not either.

## 7. Slice sequence

Hard prerequisite order — auth is now split into **contracts** (before `admins`, so `admins` can implement an interface that already exists) and **implementation** (after `admins`, so the concrete lookup service exists to wire in):

```text
1. platform/audit                    (independent)
2. platform/auth — contracts only    (Role, AuthenticatedPrincipal, lookup port + token)
3. modules/admins                     (implements 2's port; depends on 1 for audit calls)
4. platform/auth — implementation     (JWT strategy, guards, decorators; depends on 2 + 3's concrete service, wired in 6)
5. GraphQL presentation                (depends on 3 + 4)
6. apps/api composition root           (app.module.ts wires everything, incl. the identity-lookup binding — see §9)
7. apps/web + packages bootstrap       (depends on 5, for the schema packages/client codegens against; infrastructure only)
8. /login + /admin pages + middleware  (depends on 7)
9. E2E                                  (depends on 1-8)
```

Each numbered task below is an independently reviewable slice.

## 8. TDD / verification strategy

Unit tests (Jest, mirroring `bookings.service.spec.ts`'s `Test.createTestingModule` + mocked `Repository` pattern) for: `AuditLogger`'s best-effort-never-throws contract, `modules/admins`' application service (create/list/disable, last-Owner guard, self-disable guard, the create/disable-transaction-fails-if-audit-fails guarantee, login credential verification, error-indistinguishability), `platform/auth`'s guard (authenticated/unauthenticated/disabled-account/role-mismatch cases) and JWT strategy (cookie extraction, per-request lookup-port invocation).

Integration/e2e (Jest + Supertest against a real Postgres via `AppModule`, mirroring `test/app.e2e-spec.ts`): the full flow in spec §4.10, using a dedicated test-fixture helper to seed its own initial Owner (not the dev `seed.ts` script — see Task 9).

No test-framework changes — reuse the existing `apps/api` Jest config (unit specs under `tests/`, e2e under `apps/api/test/`) and `bookings`' file-per-concern layout (`domain/`, `application/{commands,services}`, `infrastructure/persistence`, `presentation/graphql`).

## 9. Task breakdown

### Task 1 — `platform/audit`

**Files (new):**
- `apps/api/src/platform/audit/domain/audit-event.ts` — plain `AuditEvent` interface (§3 of spec)
- `apps/api/src/platform/audit/domain/json-value.ts` — the `JsonValue` union (§4 above)
- `apps/api/src/platform/audit/application/audit-logger.port.ts` — `AuditLogger` interface (`log(event): Promise<void>` only) + DI token
- `apps/api/src/platform/audit/infrastructure/persistence/audit-event.entity.ts` — TypeORM entity; the module exposes no update/delete repository method anywhere
- `apps/api/src/platform/audit/infrastructure/audit-logger.service.ts` — implements the port; internally best-effort (catches persistence errors, logs them via Nest's `Logger`, never rethrows) — this is the *entire* implementation for this task; ambient-transaction participation (§4 above) is wired when `modules/admins` (Task 3) actually needs it, not invented speculatively here
- `apps/api/src/platform/audit/audit.module.ts` — exports the port binding
- `apps/api/src/platform/audit/tests/audit-logger.service.spec.ts`

**Files (modified):**
- `apps/api/src/platform/database/data-source.ts` — add `AuditEventEntity` to `entities`
- Generate migration: `pnpm migration:generate add audit event` → new file under `platform/database/migrations/` (first of two intentionally separate migrations for this slice — see Task 3's note)

**Tests to write first (TDD):**
- `log()`: given a repository mock that throws on save, `log()` resolves (does not throw) and the error reaches the injected `Logger` mock.
- `log()`: given a healthy repository mock, the persisted row matches the event shape (`action`, nullable `entityType`/`entityId`, `metadata`).

**Traceability:** spec §4.6, §5.3.

### Task 2 — `platform/auth` — contracts

**Files (new):**
- `apps/api/src/platform/auth/domain/role.ts` — the 6-value enum
- `apps/api/src/platform/auth/domain/authenticated-principal.ts` — `{ id, role }`
- `apps/api/src/platform/auth/application/admin-identity-lookup.port.ts` — `findActiveAdminById(id): Promise<AuthenticatedPrincipal | null>` interface + DI token (`ADMIN_IDENTITY_LOOKUP`)

**Tests:** none — pure type/interface definitions, nothing to execute yet. Verified by Task 3 compiling against them and Task 4's tests exercising the port through a real implementation.

**Traceability:** spec §3, §4.7, §5.2; this plan's §6 (contract inventory).

### Task 3 — `modules/admins`

**Files (new):**
- `apps/api/src/modules/admins/domain/admin-user.ts` — plain interface: `{ id, email, passwordHash, role, isActive, createdAt }` (imports `Role` from `platform/auth`)
- `apps/api/src/modules/admins/infrastructure/persistence/admin-user.entity.ts` — TypeORM entity implementing `AdminUser`; `email` has a unique constraint on the normalized (lowercase) value — required for §4.3's "look up by email" login step to be well-defined; without it, two accounts could share an email and login would have no deterministic match
- `apps/api/src/modules/admins/infrastructure/admin-identity-lookup.service.ts` — implements Task 2's `AdminIdentityLookupPort` by querying `AdminUserEntity` (filters on `isActive`)
- `apps/api/src/modules/admins/application/commands/create-admin.command.ts`, `disable-admin.command.ts` — plain command interfaces (mirroring `bookings`' command style)
- `apps/api/src/modules/admins/application/services/admins.service.ts` — `create`, `list`, `disable`. `create`/`disable` each open a transaction (`EntityManager.transaction(...)`), perform the `AdminUserEntity` write, and call `AuditLogger.log(...)` such that an audit failure fails the whole transaction (§3's transactional guarantee — the *mechanism* is chosen here, e.g. constructing the audit implementation with the transaction's own `EntityManager` for the duration of the call; the public `AuditLogger.log()` signature itself stays untouched). `disable`'s self-disable check (a pure id comparison, no concurrent-mutation risk) happens before opening the transaction, but the **last-active-Owner check happens inside the transaction using a locking read** (e.g. `SELECT COUNT(*) FROM admin_user WHERE role = 'OWNER' AND "isActive" = true FOR UPDATE`, or TypeORM's equivalent pessimistic lock) — checking before the transaction would be a check-then-act race where two concurrent disable-Owner requests could each observe "more than one active Owner" and both proceed, leaving zero. The locking read serializes concurrent disable attempts against each other, which is the actual guarantee §4.4 requires.
- `apps/api/src/modules/admins/application/services/login.service.ts` — verifies email (case-insensitive) + password against `AdminUserEntity` (bcrypt compare), returns `AuthenticatedPrincipal | null` (`null` covers unknown email, wrong password, and disabled — indistinguishable per §4.3); calls `AuditLogger.log('admin.login.succeeded' | 'admin.login.failed', ...)` per §4.3/§4.6 (a plain best-effort call — login has no accompanying state change to be transactional with, matching §4.6's differentiated guarantee)
- `apps/api/src/modules/admins/admins.module.ts` — exports `AdminIdentityLookupService` bound to `ADMIN_IDENTITY_LOOKUP` for the composition root (Task 6) to consume; does **not** import `AuthModule`
- `apps/api/src/modules/admins/tests/application/admins.service.spec.ts`
- `apps/api/src/modules/admins/tests/application/login.service.spec.ts`

**Files (modified):**
- `apps/api/src/platform/database/data-source.ts` — add `AdminUserEntity`
- Generate migration: `pnpm migration:generate add admin user` (intentionally the second, separate migration — audit and admin tables are independently reviewable and independently revertible)
- Add `bcrypt` + `@types/bcrypt` to `apps/api/package.json`
- `apps/api/src/platform/database/seed.ts` — add a dev-only Owner seed reading `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` from the environment (mirroring `.env.example`'s pattern for `DB_*`); the seeder MUST NOT hardcode credentials and MUST no-op (with a log message) if either variable is unset. This is a developer convenience, separate from the e2e fixture in Task 9.

**Tests to write first (TDD):**
- `create`: persists an `AdminUser` with a bcrypt hash (never the plaintext), records `admin.created`. With a forced audit failure (mock the transaction's audit call to throw), assert the `AdminUser` row does not exist afterward (the actual transactional guarantee, observed at this layer — not via a special audit method).
- `disable`: rejects self-disable; rejects disabling the last active Owner; allows disabling a non-last Owner; records `admin.disabled`; same forced-audit-failure rollback assertion as `create`; two concurrent `disable` calls targeting two different Owners when exactly two active Owners exist — at most one MUST succeed (proves the locking read actually serializes, not just that the count is checked).
- `create`: a second `create` with an email already in use (differing only in case) is rejected — proves the unique constraint, not just the normalization.
- `login.service`: unknown email → `null` + `admin.login.failed`; wrong password → same; disabled account → same (all three assert the *same* outward result and the *same* generic failure path, proving indistinguishability); correct credentials on an active account → principal + `admin.login.succeeded`.
- `admin-identity-lookup.service`: returns `null` for a disabled or nonexistent id; returns the principal for an active one.

**Traceability:** spec §4.3, §4.4, §4.5, §4.6, §5.2.

### Task 4 — `platform/auth` — implementation

**Files (new):**
- `apps/api/src/platform/auth/infrastructure/jwt.strategy.ts` — Passport `Strategy`; extracts the JWT from the named session cookie (custom `ExtractJwt` function reading `req.cookies[<the shared cookie-name constant, §4>]`, **not** the bearer-header extractor); validates signature/expiry; extracts `sub`; delegates to `ADMIN_IDENTITY_LOOKUP` for the fresh DB read; returns `null`/throws when absent or inactive (§4.1)
- `apps/api/src/platform/auth/infrastructure/token.service.ts` — issues JWTs (`sub` only, 8h expiry) via `@nestjs/jwt`; constructor/factory throws at startup if `JWT_SECRET` is unset outside test environments (§3)
- `apps/api/src/platform/auth/guards/auth.guard.ts` — wraps the Passport JWT guard for GraphQL context (`GqlExecutionContext`)
- `apps/api/src/platform/auth/decorators/roles.decorator.ts` — `@Roles(...roles: Role[])`, OR semantics, paired with a `RolesGuard` (or folded into `auth.guard.ts` — implementer's choice, not a new product contract)
- `apps/api/src/platform/auth/decorators/current-user.decorator.ts` — `@CurrentUser()` returning `AuthenticatedPrincipal`
- `apps/api/src/platform/auth/auth.module.ts` — provides `TokenService`, `JwtStrategy`, `AuthGuard`, decorators. Declares a dependency on the `ADMIN_IDENTITY_LOOKUP` token via `@Inject(...)` but does **not** `import: [AdminsModule]` — the concrete binding is supplied by the composition root (Task 6), per §3's explicit prohibition on `platform/auth` importing `AdminsModule`
- `apps/api/src/platform/auth/tests/auth.guard.spec.ts`
- `apps/api/src/platform/auth/tests/jwt.strategy.spec.ts`

**Files (modified):**
- `apps/api/package.json` — add `@nestjs/passport`, `@nestjs/jwt`, `passport`, `passport-jwt`, `@types/passport-jwt`, `cookie-parser`, `@types/cookie-parser`
- `.env.example` — add `JWT_SECRET`, `JWT_EXPIRES_IN=8h`, `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD` (documented as dev-only, not committed real values)

**Tests to write first (TDD):**
- Guard: no cookie → unauthenticated; valid token but `ADMIN_IDENTITY_LOOKUP` returns `null` (not found or inactive) → unauthenticated (proves §4.1's disabled-account behavior at the guard level, independent of the later e2e); valid token, active account, no `@Roles()` → allowed; valid token, active account, role not in `@Roles(...)` list → denied; role in list → allowed.
- Strategy: the lookup port is invoked on every validation call (assert call count, not a cached result) — proves §4.1's "no caching" guarantee at the unit level.
- `TokenService`: constructing/using it with `JWT_SECRET` unset throws (outside a test-env override).

**Traceability:** spec §4.1, §4.2, §4.7, §5.1, §5.2.

### Task 5 — GraphQL presentation

**Files (new):**
- `apps/api/src/modules/admins/presentation/graphql/admin.type.ts` — explicit presentation type (id, email, role, isActive — never `passwordHash`), `create-admin.input.ts`, `login.input.ts`, `login-result.type.ts`, `current-admin.type.ts` (may differ in shape from `AuthenticatedPrincipal`, per §3)
- `apps/api/src/modules/admins/presentation/graphql/admin.resolver.ts` — `login` (public, sets the cookie via `@Context()` `res`), `createAdmin`/`disableAdmin`/`admins` (Owner-gated), `currentAdmin` (any authenticated role) — exactly the 5 operations of spec §4.9, no others; no admin/entity object is ever returned directly from a domain/persistence type. `login`'s orchestration order is explicit: call Task 3's `LoginService` for credential verification → on a non-null result, call Task 4's `TokenService` to issue the JWT → set the cookie (§4 cookie-name constant) → return the result. `LoginService` itself has no dependency on `TokenService` (it lives in `modules/admins`; `TokenService` lives in `platform/auth`) — only the resolver, which already depends on both application layers by construction, composes them. This is the ordinary "presentation depends on application services" direction, not the platform→modules direction §5.2 forbids.
- `apps/api/src/modules/admins/tests/graphql/admin.resolver.spec.ts`

**Tests to write first (TDD):**
- Resolver-level: `createAdmin`/`disableAdmin`/`admins` are decorated with `@Roles(Role.OWNER)` and `AuthGuard`; `currentAdmin` has `AuthGuard` only; `login` has neither (assert via Nest's reflected metadata).
- `AdminType`'s field set does not include `passwordHash` (assert on the GraphQL type definition/schema, not just runtime data) — the compile-time guarantee that presentation types are hand-defined, not the entity, makes this test a confirmation, not the only line of defense.

**Traceability:** spec §4.8, §4.9, §5.5, §5.6, and this plan's §3 GraphQL-type-boundary constraint.

### Task 6 — `apps/api` composition root

**Files (modified):**
- `apps/api/src/app/app.module.ts` — imports `AuditModule`, `AdminsModule`, `AuthModule` alongside the existing `BookingsModule`, and wires the identity-lookup binding at this level (e.g. `AuthModule.forRoot({ identityLookup: AdminIdentityLookupService })`, or an equivalent provider-override pattern at the `AppModule` level) — the exact mechanism is an M6 choice; the constraint this task locks is *where* the wiring happens (the composition root) and *not* a direct `AuthModule → AdminsModule` import
- `apps/api/src/main.ts` — register `cookie-parser` middleware (`app.use(cookieParser())`, so the JWT extractor can read the configured session cookie from incoming requests) and enable credentialed CORS (`app.enableCors({ origin: <configured web origin>, credentials: true })`) — required for the browser to send the HttpOnly cookie across the `apps/web` ↔ `apps/api` origin boundary (§4)
- Run `pnpm migration:run` locally (dev-environment step, not a committed file change beyond the migrations already generated in Tasks 1 and 3)

**Tests:** none new — this task's verification is that the full `AppModule` still boots (`nest start` succeeds) and the existing `bookings` e2e test still passes unmodified (regression check).

**Traceability:** ties Tasks 1–5 into the running application per §3's composition-root constraint; no new spec surface.

### Task 7 — `apps/web`, `packages/client`, `packages/ui` bootstrap

Infrastructure bootstrap, **not** a feature task — minimum viable scaffolding only (§2 finding above), not a general app shell.

**Files (new):**
- `apps/web/package.json` (Next.js, React, TypeScript, Tailwind deps), `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `app/layout.tsx` (minimal root layout), `app/globals.css`
- `packages/client/package.json` (Apollo Client + `@graphql-codegen/cli` deps), `src/apollo-client.ts` (client pointed at `apps/api`'s GraphQL endpoint via env var, configured with `credentials: 'include'` so the browser sends the HttpOnly session cookie — required by §4's CORS/cookie-transport decision), codegen config generating typed hooks from `apps/api`'s schema (the schema Task 5 produces)
- `packages/ui/src/button.tsx`, `form-field.tsx`, `data-table.tsx`, `status-badge.tsx` — only the four primitives `/login` and `/admin` actually use (Phase 1 design's named component set, scoped down); no `Modal` — `/admin`'s create-staff form is an inline page section, not a modal, since nothing in this slice's UI needs an overlay (planning decision, not a product requirement — revisit when a real need appears)

**Tests:** none — pure scaffolding, no behavior yet. Verified by Task 8's pages actually rendering against it.

**Traceability:** spec §2 (`apps/web` in scope); component set from Phase 1 design (informative).

### Task 8 — `/login`, `/admin`, route middleware

**Files (new):**
- `apps/web/app/login/page.tsx` — email/password form calling the `login` mutation via `packages/client`; on success the cookie is already set by the API response (§4.8) — the page just redirects to `/admin`
- `apps/web/app/admin/page.tsx` — reads `currentAdmin` first; if `role !== OWNER`, renders a "not authorized" message instead of the management UI (a presentation nicety using `currentAdmin.role` for UX — API authorization per §4.2/§4.5 remains authoritative regardless of what this page renders, per §3). For an Owner: staff list (`admins` query, `DataTable` + `StatusBadge`), inline create-staff section (`createAdmin` mutation, `FormField`s for email/password/role), disable action per row (`disableAdmin` mutation)
- `apps/web/middleware.ts` — checks only for the session cookie's presence to redirect to `/login` when absent (§4.8's UX-hint-only contract — it does not decode the JWT or make any role decision)

**Tests:** none required beyond Task 9's e2e coverage — the spec's verification requirement (§4.10) is expressed as an API-level e2e, not a web-layer test; adding web-level tests here would be scope beyond what the Accepted spec asks for.

**Traceability:** spec §2, §4.5 (`/admin` Owner-only — enforced by the API; §3's UX-vs-authority note governs the page's own role-based rendering).

### Task 9 — E2E acceptance

**Files (new):**
- `apps/api/test/helpers/seed-owner.ts` — a test-only fixture helper that inserts an Owner directly against the test database, independent of the dev `seed.ts` script (Task 3) — keeps the e2e genuinely self-contained, matching `bookings`' e2e precedent, rather than depending on `pnpm db:seed` having been run first
- `apps/api/test/admin-foundation.e2e-spec.ts` — implements spec §4.10 exactly, using the fixture helper in `beforeAll`/`beforeEach`:
  1. Log in as the fixture Owner → `createAdmin` (Scheduler) succeeds → `admin.created` recorded (assert via direct repository/DB read — no GraphQL query exposes audit events, per §3).
  2. Log in as that Scheduler → `createAdmin` denied, `disableAdmin` denied.
  3. Log in as Owner → `disableAdmin(schedulerId)` succeeds → `admin.disabled` recorded.
  4. A bad-password login attempt → `admin.login.failed`, no actor.
  5. The disabled Scheduler's previously issued JWT/cookie is rejected on its next protected request.

**Traceability:** spec §4.10 exactly.

## 10. Public surfaces requiring implementation

Already fixed by the spec/contract inventory (§6 above): `AuthenticatedPrincipal`, `Role`, the admin-identity-lookup port, `AuditLogger.log()` (and only that method), and the 5 GraphQL operations. No additional public surface is introduced anywhere in the task breakdown — the earlier draft's `logWithinTransaction()` addition has been removed per M5 review. Internal service/file names in the task breakdown are planning aids per M4 rule 12 — not frozen contracts.

## 11. Self-check (planner)

| Check | Status |
| --- | --- |
| Every major task traces to the Accepted specification | ✅ — each task cites spec section(s) |
| No task introduces new product semantics | ✅ — Task 7/8 scaffolding and Task 9's fixture helper are planning/execution necessities, not new capabilities |
| Task ordering executable without inventing missing work | ✅ — §7 hard-prerequisite chain; auth contracts now precede `admins`' implementation of them |
| Deferred work explicitly identified | ✅ — §3 SHALL NOT list; §4 separates M4 choices from spec constraints |
| Missing design semantics → returned to M2/M3 | N/A — none found; §2's finding is a sizing note, not a semantics gap |
| Public contract matches the Accepted spec exactly | ✅ — §10; `AuditLogger` is single-method, matching spec §4.6's "single call contract" |

## 12. Non-goals of this plan

- Redesigning the Accepted specification.
- Plan Review decisions (M5) — this plan does not self-Accept.
- Any implementation activity (M6) — no code is written at this stage.
- A general-purpose `apps/web` shell beyond what `/login` and `/admin` need.
