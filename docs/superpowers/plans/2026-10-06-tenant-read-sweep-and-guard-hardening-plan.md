# Tenant-Read Sweep Classification, Metadata-Guard Hardening and CI e2e Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Accepted |
| M5 decision | **Accepted** — 2026-10-06, at `0754d9a`, by the owner, on the second pass, with no further revision. Execution: native (inline). The owner accepted both points where the first pass's suggestion was not adopted: class metadata is read with `Reflect.getMetadata`, so inherited metadata counts (M1c), and roles are `method ?? class`, the roles `AuthGuard` enforces (M1d). The owner also accepted not repeating the fresh-database run after the revision. M6 MUST implement Tasks 1–3 as written. If the Task 2 Step 1 sources differ from the plan, M6 stops and returns to M5. |
| M5 history | First pass (2026-10-06) returned three must-fix items and four smaller ones. None changed the approach. Each is resolved below.<br>**(1) Metadata inheritance:** Task 2 Step 1 now records the decision. The guard reads class metadata with `Reflect.getMetadata`, so inherited metadata counts, because that is how Nest's guard context and `AuthGuard` read it. `getOwnMetadata` would miss a guard inherited from a base class, as mutation M1c shows.<br>**(2) Role fallback:** kept, with its reason. `method ?? class` is exactly `AuthGuard`'s `getAllAndOverride([handler, class])`, so a record shows the handler's effective roles. A field with roles on both the class and the method is still flagged (mutation M1d). An additive list would report roles that `AuthGuard` never applies, and would turn an empty `@Roles()` into `[]`. That `[]` needs a different assertion from today's `roles !== undefined`.<br>**(3) CI parity:** Task 3 now derives the job from the live `release-gate` job and checks parity mechanically.<br>**Also applied:** a check that the release gate is absent from the CI run's suite list; reverts narrowed to the two mutated files; the exact mutation code (Task 2 Step 2); `unresolved` renamed to `nonObjectResolverTypes`; "Every live" changed to "Every discovered"; a `git status` check before pushing. |
| Date | 2026-10-06 |
| Tracking issue | [#135](https://github.com/rexescario-dev/clensy-platform/issues/135). Its scope was extended on 2026-10-06, with the owner's approval, by two follow-ons from [#106](https://github.com/rexescario-dev/clensy-platform/issues/106) / PR [#136](https://github.com/rexescario-dev/clensy-platform/pull/136): (a) the three Minor test-hardening items in the M6/M7 records of [the relation-field authorization plan](2026-10-06-relation-field-authorization-plan.md), and (b) its M10 observation 1 (CI does not run the full API e2e suites). |
| M2 / M3 | **N/A** — owner decision, 2026-10-06. #135 adds no product or authorization semantics. It classifies fields under an existing guard, strengthens an existing verification, and adds a CI job. |
| Scope | `apps/api/test` (two existing e2e suites) and `.github/workflows/ci.yml` (one new job). No change to `apps/api/src`, `apps/web`, `packages/*`, migrations, `schema.gql`, role matrices or the `Release gate` job. No application behavior change. |
| Implements (Accepted) | [Multi-Tenant Architecture RFC](../specs/2026-09-23-multi-tenant-architecture-design.md), Status **Accepted** (including the §4.2 relation-field authorization amendment, Accepted 2026-10-06): §4.5 tenant isolation of GraphQL reads, as guarded by the #90 sweep ([#90 plan](2026-10-01-tenant-aware-audit-security-sweep-plan.md), decisions 7–8: every object-typed field is a declared relation or an allowlisted custom field with its reason); §4.2 Required verification 7 (the metadata guard fails if any relation field declares relation-level `guards` or `@Roles()`). |
| Relies on (Accepted) | [Tenant Label Overrides — Design](../specs/2026-10-03-tenant-label-overrides-design.md), Status **Accepted** (#118): §4.3 (the nullable `CurrentAdmin.tenantLabelOverrides` field and its two object types) and §4.7 items 1–2 (the field resolves only from the principal's tenant, takes no arguments, and returns `null` for Super Admin). Used as is. |
| Authority | Where this plan and an Accepted spec disagree, the **spec wins** and this plan must be revised. Allowlist wording, helper and interface names, comment text, the CI job id and name, and task order are planning decisions, not product semantics. |
| Edit anchors | Every edit is located by the **quoted code**, not by line number. The branch base is `0e50831` (`main`). |

**Goal:** Make `pnpm --filter api test:e2e` green on `main` again, and keep it from silently going red:

1. classify the two object-typed fields #118 added in the #90 sweep's `CUSTOM_OBJECT_FIELDS` allowlist;
2. close the three known blind spots of the #106 metadata guard;
3. run every API e2e suite except the release gate in a new CI job.

**Architecture:** Test and CI changes only.

- The #90 sweep's mechanism is unchanged. It gains two allowlist entries, each with its reason.
- In the #106 suite, `objectFieldResolvers()` also reads class-level metadata the way Nest does, reports typed resolvers whose type is not a schema object type, and reads methods through property descriptors. The Required verification 7 test also asserts that this report is empty.
- The new CI job is the `Release gate` job with a different name and final command: the full e2e config minus the release-gate suite.

**Tech Stack:** NestJS 11, `@nestjs/graphql` + Apollo, `@ptc-org/nestjs-query-graphql` 9.5.0, TypeORM, PostgreSQL 16, Jest e2e (`apps/api/test/jest-e2e.json`, `maxWorkers: 1`), GitHub Actions.

**Discovered at planning time.** The issue names only `CurrentAdmin.tenantLabelOverrides`. With that one entry added, the same test still fails, now on `TenantLabelOverrides.roles`. `expect` stops at the first miss, so the first failure hid the second. #118 added both object-typed fields, so both are classified here (Task 1). With both entries, the inventory has no further unclassified field.

**Pre-validation (full).** Before M5, on 2026-10-06, every edit in Tasks 1–3 was applied verbatim to a working tree at `0e50831`. Every command named by an `Expected:` line ran with the stated result. After the first M5 pass, the revised edits were applied again at `8a14cf1`. All of the following were then re-run with the same results:

- every mutation run in Task 2, from the exact mutation code in Step 2, including M1c, M1d and the `getOwnMetadata` comparison;
- the two-suite run;
- the full and CI-scoped e2e runs;
- the parity and suite-list checks;
- `tsc`, lint and the unit tests.

The tree was reverted after each pass. Commands run:

- `pnpm --filter api exec jest --config test/jest-e2e.json test/tenant-read-authorizers.e2e-spec.ts` (RED before Task 1 on `CurrentAdmin.tenantLabelOverrides`; RED on `TenantLabelOverrides.roles` with only the first entry; GREEN with both)
- `pnpm --filter api exec jest --config test/jest-e2e.json test/relation-field-authorization.e2e-spec.ts -t "declares no guards"`, under each Task 2 mutation, with the old and the new guard (results in Task 2)
- `pnpm --filter api exec jest --config test/jest-e2e.json test/relation-field-authorization.e2e-spec.ts test/tenant-read-authorizers.e2e-spec.ts` (2 suites, 29 tests passed)
- `pnpm --filter api test:e2e --testPathIgnorePatterns two-tenant-release-gate` (48 suites, 446 tests passed, about 80 s). In the first pass it also ran against a freshly created and migrated scratch database (`clensy_ci_probe`, dropped afterwards), as CI's fresh service DB would be, with the same result. The fresh-DB run was not repeated after the M5 revision: the revision changed only the metadata guard's code, which reads no database data.
- `pnpm --filter api test:e2e --testPathIgnorePatterns two-tenant-release-gate --listTests` vs. `pnpm --filter api test:e2e --listTests` (48 vs. 49 suites; the only difference is `test/two-tenant-release-gate.e2e-spec.ts`)
- the Task 3 Step 3 parity check (`env`, `runs-on`, `services` and every step but the last are identical to `release-gate`)
- `pnpm --filter api test:e2e` (49 suites, 458 tests passed)
- `pnpm --filter api exec tsc --noEmit`, `pnpm run lint` (exit 0), `pnpm --filter api test` (73 suites, 987 tests passed)
- `pnpm --filter api exec prettier --check` and `pnpm --filter api exec eslint` on both edited suites

The counts above are a record, not acceptance criteria. The acceptance criteria are semantic (Final verification).

## Global Constraints

Every task's requirements implicitly include this section.

- The #90 allowlist mechanism is unchanged. A field is either a declared nestjs-query relation or a `CUSTOM_OBJECT_FIELDS` entry with a one-line reason. The suite's stale-entry check (every entry must be live and not a declared relation) applies to the new entries (#90 decision 8).
- An allowlist reason MUST state why the field cannot expose another tenant's data, from the Accepted #118 contract: the parent `CurrentAdmin` is built only from the principal, so the field reads only the principal's own tenant's labels (tenant-label-overrides spec §4.3, §4.7 items 1–2).
- The metadata guard keeps its five sentinels (`Booking.team`, `CleaningJob.team`, `Cleaner.team`, `Invoice.customer`, `Customer.properties`), so it can't pass vacuously. Its assertion that no relation field resolver declares guards or `@Roles()` (`guards.length > 0 || roles !== undefined`) is unchanged; it only sees more (RFC §4.2 Required verification 7).
- The guard reads metadata the way the runtime does (Task 2 Step 1). It MUST NOT use a narrower lookup than Nest's guard context or `AuthGuard`, because a narrower lookup is a blind spot.
- Resolvers with no `@Resolver` type, i.e. root resolvers, are still skipped by the guard. Only a resolver that names a type that is not a schema object type is reported.
- No change to `apps/api/src`. The mutations in Task 2 are temporary. They are reverted by checking out exactly the two mutated files, never a whole directory.
- The `Release gate` job, its name and its command (`pnpm --filter api test:e2e:release-gate`) are unchanged. The RFC's Tracking row cites that command.
- The new CI job is an ordinary check that can fail: no `continue-on-error`. #135 **creates** the check. It does **not** make it a required status check: no branch protection or ruleset change.
- The new job runs as one unsharded job.

## Review Focus

1. **Allowlist reasons.** Each reason must hold for the code as shipped. `CurrentAdminLabelOverridesResolver.tenantLabelOverrides` takes no arguments and reads `admin.tenantId` from its parent, which `toCurrentAdminType(principal)` builds (resolver header comment). It returns `null` for platform scope. `TenantLabelOverrides.roles` has no resolver of its own; it is the plain object that field returns.
2. **Guard semantics and regressions.**
   - A record's `guards` and `roles` must be what the runtime applies to the handler. Guards are global + class + method, concatenated by Nest's `ContextCreator.createContext`; global guards are out of scope, as they are today. Roles are `AuthGuard`'s `getAllAndOverride([handler, class])`.
   - The hardened guard must stay green on the real code. It must not newly report a legitimate resolver, e.g. one targeting an interface type, or a nestjs-query resolver with class-level guards hosting a relation.
   - Pre-validation found none: `nonObjectResolverTypes` is `[]`, and no class-level metadata reaches a record. Each hardening is shown to catch its mutation (Task 2).
3. **CI parity.** The job must be the live `release-gate` job except for its name and its final command, and that is checked mechanically (Task 3 Step 3). The release-gate suite must be absent from its suite list, so it doesn't run twice.

---

## File Map

| File | Change | Task |
| --- | --- | --- |
| `apps/api/test/tenant-read-authorizers.e2e-spec.ts` | Two `CUSTOM_OBJECT_FIELDS` entries | 1 |
| `apps/api/test/relation-field-authorization.e2e-spec.ts` | `objectFieldResolvers()` hardening; Required verification 7 test also asserts no non-object resolver types | 2 |
| `.github/workflows/ci.yml` | New `api-e2e` job (`API e2e`) | 3 |
| This plan | Gate outcomes (M5–M10) appended as they arrive | 4 and later |

**Untouched:** `apps/api/src/**` (the Task 2 mutations are reverted), `apps/web`, `packages/*`, migrations, `schema.gql`, `role-matrix.ts`, `root-operation-inventory.ts`, the other e2e suites, the `lint`, `test` and `release-gate` CI jobs, and `apps/api/package.json`.

**Environment:** the e2e suites need the e2e Postgres. Locally: `docker compose up -d postgres`, then `pnpm --filter api migration:run`.

---

### Task 1: Classify #118's object fields in the #90 sweep (RFC §4.5; #90 decisions 7–8; tenant-label-overrides spec §4.3, §4.7 items 1–2)

**Files:**
- Modify: `apps/api/test/tenant-read-authorizers.e2e-spec.ts`

- [ ] **Step 1: Confirm RED.** No edit yet.

Run: `pnpm --filter api exec jest --config test/jest-e2e.json test/tenant-read-authorizers.e2e-spec.ts`
Expected: exactly one failure, "accounts for every object-typed field: declared relation or allowlisted custom field", on `{ fieldKey: "CurrentAdmin.tenantLabelOverrides", recognized: false }`. Every other test in the suite passes.

- [ ] **Step 2: Add both entries.** The map is kept in key order. In `CUSTOM_OBJECT_FIELDS`, insert directly above `  'LaundryOrderLine.pricingSnapshot':`

```ts
  'CurrentAdmin.tenantLabelOverrides':
    "CurrentAdminLabelOverridesResolver @ResolveField; its parent is built only from the principal, so it reads the principal's own tenant's labels (#118).",
```

and replace

```ts
  'Service.activePricing':
    'ServiceResolver @ResolveField via request-scoped ActivePricingLoader keyed by the principal tenant (#84).',
};
```

with

```ts
  'Service.activePricing':
    'ServiceResolver @ResolveField via request-scoped ActivePricingLoader keyed by the principal tenant (#84).',
  'TenantLabelOverrides.roles':
    'Plain value object that CurrentAdmin.tenantLabelOverrides builds from those same labels; no resolver of its own (#118).',
};
```

If only the first entry were added, the same test would fail on `TenantLabelOverrides.roles` (see "Discovered at planning time").

- [ ] **Step 3: GREEN.**

Run: `pnpm --filter api exec jest --config test/jest-e2e.json test/tenant-read-authorizers.e2e-spec.ts`
Expected: every test passes, including "accounts for every object-typed field" and its stale-entry half (both new keys are live and are not declared relations).

- [ ] **Step 4: Commit.**

```bash
git add apps/api/test/tenant-read-authorizers.e2e-spec.ts
git commit -m "test(api): classify #118's tenant label override fields in the #90 sweep (#135)"
```

---

### Task 2: Harden the #106 metadata guard (RFC §4.2 Required verification 7; #106 M6/M7 Minor items 1–3)

**Files:**
- Modify: `apps/api/test/relation-field-authorization.e2e-spec.ts`
- Temporarily mutate, then restore: `apps/api/src/modules/admins/presentation/graphql/current-admin-label-overrides.resolver.ts` (all mutations) and `apps/api/src/modules/admins/admins.module.ts` (M2 only)

- [ ] **Step 1: Metadata semantics (decision, verified at planning time).** The guard models what the runtime applies to a field resolver. It does not model a narrower notion of "declared". The decision rests on three facts, re-checkable in the installed sources:

- **Guards.** `@nestjs/core` `helpers/context-creator.js` `createContext()` returns global + class + method guards. Class guards are `Reflect.getMetadata(GUARDS_METADATA, instance.constructor)`, which walks the class prototype chain, so a guard declared on a base class applies. Method guards are `Reflect.getMetadata(GUARDS_METADATA, callback)`. The guard therefore concatenates class and method guards, both read with `Reflect.getMetadata`. Global guards (`APP_GUARD` / `useGlobalGuards`) are outside this guard's scope, as they are today.
- **Roles.** `AuthGuard` (`src/platform/auth/guards/auth.guard.ts`) reads `this.reflector.getAllAndOverride(ROLES_KEY, [context.getHandler(), context.getClass()])`. `Reflector.get` is `Reflect.getMetadata`, so the method's roles override the class's, and class roles are inherited. The guard records `methodRoles ?? classRoles`, exactly that value.
  - A field whose class and method both declare roles is still flagged, because the value is not `undefined` (M1d).
  - An empty `@Roles()` stays detectable as `[]`, because the unchanged assertion is `roles !== undefined`.
  - A merged list is not used: it would report roles `AuthGuard` never applies, and it would need a different assertion.
- **Why not `getOwnMetadata`.** It would miss a guard inherited from a resolver base class. That guard applies at runtime. Mutation M1c fails under `Reflect.getMetadata` and passes under a `Reflect.getOwnMetadata` variant of the same guard, which shows the blind spot.

If an implementer finds that these sources differ from the above, e.g. after a dependency upgrade, they must stop and return the plan to M5 rather than pick a different lookup.

- [ ] **Step 2: The mutations (temporary; exact code).** Every mutation edits `current-admin-label-overrides.resolver.ts`, which hosts the object-typed `CurrentAdmin.tenantLabelOverrides`. M2 also edits `admins.module.ts`. Apply one at a time, and revert after each run with:

```bash
git checkout -- \
  apps/api/src/modules/admins/presentation/graphql/current-admin-label-overrides.resolver.ts \
  apps/api/src/modules/admins/admins.module.ts
```

Paths are relative to `apps/api/src/modules/admins/presentation/graphql/`.

- **M1a (class `@UseGuards`):**
  - add `import { UseGuards } from '@nestjs/common';` and `import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';`;
  - insert `@UseGuards(AuthGuard)` on the line directly below `@Resolver(() => CurrentAdminType)`.
- **M1b (class `@Roles`):**
  - add `import { Roles } from '../../../../platform/auth/decorators/roles.decorator';` and `import { Role } from '../../../../platform/auth/domain/role';`;
  - insert `@Roles(Role.TENANT_OWNER)` directly below `@Resolver(() => CurrentAdminType)`.
- **M1c (inherited class guard):** with M1a's imports, replace

  ```ts
  @Resolver(() => CurrentAdminType)
  export class CurrentAdminLabelOverridesResolver {
    constructor(
      private readonly tenantLabelOverridesService: TenantLabelOverridesService,
    ) {}
  ```

  with

  ```ts
  @UseGuards(AuthGuard)
  abstract class GuardedResolverBase {}

  @Resolver(() => CurrentAdminType)
  export class CurrentAdminLabelOverridesResolver extends GuardedResolverBase {
    constructor(
      private readonly tenantLabelOverridesService: TenantLabelOverridesService,
    ) {
      super();
    }
  ```

- **M1d (class and method roles):**
  - with M1b's imports, insert `@Roles(Role.OPS_MANAGER)` directly below `@Resolver(() => CurrentAdminType)`;
  - insert `@Roles(Role.TENANT_OWNER)` on the line directly above `@ResolveField('tenantLabelOverrides', () => TenantLabelOverridesType, {`.
- **M2 (non-object resolver type):**
  - append this to the end of the resolver file:

    ```ts

    @Resolver('NoSuchType')
    export class ProbeResolver {}
    ```

  - in `admins.module.ts`, change `import { CurrentAdminLabelOverridesResolver } from` to `import {\n  CurrentAdminLabelOverridesResolver,\n  ProbeResolver,\n} from`;
  - insert `    ProbeResolver,` directly below `    CurrentAdminLabelOverridesResolver,` in `providers`.
- **M3 (getter):** insert, directly above `@ResolveField('tenantLabelOverrides', () => TenantLabelOverridesType, {`:

  ```ts
  get probe(): never {
    throw new Error('getter invoked');
  }

  ```

  A class accessor is a **non-enumerable** own property of the class prototype. The guard's walk uses `Object.getOwnPropertyNames`, which lists non-enumerable properties too, so the walk reaches `probe`. That is why the old guard invokes it.

Every mutation run is: `pnpm --filter api exec jest --config test/jest-e2e.json test/relation-field-authorization.e2e-spec.ts -t "declares no guards"` (1 test run, 19 skipped).

| Mutation | Old guard (unmodified suite) | New guard (after Step 4) |
| --- | --- | --- |
| M1a | passes (blind spot) | fails, listing `CurrentAdminLabelOverridesResolver.tenantLabelOverrides` |
| M1b | passes (blind spot) | fails, listing the same owner |
| M1c | passes (blind spot) | fails, listing the same owner. A `Reflect.getOwnMetadata` variant of the new guard **passes**: the blind spot Step 1 rules out. |
| M1d | fails (method-level roles were already detected) | fails, listing the same owner (the `??` fallback still flags a field with both) |
| M2 | passes (skipped silently) | fails, `nonObjectResolverTypes` = `["ProbeResolver -> NoSuchType"]` |
| M3 | fails loudly (`getter invoked`) | passes (the getter is never invoked) |

- [ ] **Step 3: Show the blind spots against the old guard.** On the unmodified suite, apply M1a, M1b, M1c, M2 and M3 in turn. Run the command after each, and revert with the two-file checkout above.

Expected: M1a, M1b, M1c and M2 pass; M3 fails with `getter invoked`.

- [ ] **Step 4: Harden `objectFieldResolvers()`.** In `apps/api/test/relation-field-authorization.e2e-spec.ts`:

(a) Directly below the `FieldResolverRecord` interface (after its closing `}`), insert:

```ts

interface FieldResolverInventory {
  // `@Resolver(...)` classes whose type name is not a schema object type.
  nonObjectResolverTypes: string[];
  records: FieldResolverRecord[];
}
```

(b) Replace

```ts
  // Every live @ResolveField() handler whose schema field is
  // object-typed, read from the metadata Nest and nestjs-query attach to
  // the method. This includes the methods nestjs-query generates for
  // relations. It is not claimed to be exhaustive over the RFC §3
  // relation-field definition.
  function objectFieldResolvers(): FieldResolverRecord[] {
    const { schema } = app.get(GraphQLSchemaHost);
    const records: FieldResolverRecord[] = [];
```

with

```ts
  // Every discovered @ResolveField() handler whose schema field is
  // object-typed, read from the metadata Nest and nestjs-query attach to
  // the method and its resolver class. This includes the methods
  // nestjs-query generates for relations. It is not claimed to be
  // exhaustive over the RFC §3 relation-field definition. A typed resolver
  // whose type is not a schema object type is reported, not skipped (#135).
  function objectFieldResolvers(): FieldResolverInventory {
    const { schema } = app.get(GraphQLSchemaHost);
    const records: FieldResolverRecord[] = [];
    const nonObjectResolverTypes: string[] = [];
```

(c) Replace

```ts
      const parentType = typeName ? schema.getType(typeName) : undefined;
      if (!isObjectType(parentType)) continue;
      const seen = new Set<string>();
```

with

```ts
      if (!typeName) continue;
      const parentType = schema.getType(typeName);
      if (!isObjectType(parentType)) {
        nonObjectResolverTypes.push(`${resolverClass.name} -> ${typeName}`);
        continue;
      }
      // Class-level @UseGuards() / @Roles() apply to every handler (#135).
      // Read as Nest does: `Reflect.getMetadata` on the class, so metadata
      // inherited from a base class counts too. Guards are class + method
      // (Nest's guard context); roles are method ?? class (`AuthGuard`'s
      // getAllAndOverride([handler, class])).
      const classGuards =
        (Reflect.getMetadata(GUARDS_METADATA, resolverClass) as
          unknown[] | undefined) ?? [];
      const classRoles = Reflect.getMetadata(ROLES_KEY, resolverClass) as
        Role[] | undefined;
      const seen = new Set<string>();
```

(d) Replace

```ts
          const handler = (proto as Record<string, unknown>)[key];
```

with

```ts
          // Read the descriptor, so a getter is never invoked (#135).
          const handler = Object.getOwnPropertyDescriptor(proto, key)
            ?.value as unknown;
```

(e) Replace

```ts
            guards:
              (Reflect.getMetadata(GUARDS_METADATA, handler) as
                unknown[] | undefined) ?? [],
            owner: `${resolverClass.name}.${key}`,
            roles: Reflect.getMetadata(ROLES_KEY, handler) as
              Role[] | undefined,
```

with

```ts
            guards: [
              ...classGuards,
              ...((Reflect.getMetadata(GUARDS_METADATA, handler) as
                unknown[] | undefined) ?? []),
            ],
            owner: `${resolverClass.name}.${key}`,
            roles:
              (Reflect.getMetadata(ROLES_KEY, handler) as Role[] | undefined) ??
              classRoles,
```

(f) Replace the function's `    return records;` with `    return { nonObjectResolverTypes, records };`.

(g) In the test `'declares no guards or @Roles() on any relation field resolver'`, replace

```ts
    const records = objectFieldResolvers();
```

with

```ts
    const { nonObjectResolverTypes, records } = objectFieldResolvers();
    expect(nonObjectResolverTypes).toEqual([]);
```

The sentinel assertion and the violation assertion below it are unchanged.

- [ ] **Step 5: GREEN on the real code.**

Run: `pnpm --filter api exec jest --config test/jest-e2e.json test/relation-field-authorization.e2e-spec.ts`
Expected: all 20 tests pass. `nonObjectResolverTypes` is `[]`, and no class-level metadata reaches a record.

- [ ] **Step 6: Show the hardened guard catches each mutation.** Apply each of M1a, M1b, M1c, M1d, M2 and M3 in turn. Run the command after each, record the "New guard" column, and revert with the two-file checkout. The `getOwnMetadata` comparison for M1c is optional at M6, because it was recorded at planning time. If it is repeated, it uses a scratch copy of the suite, never a committed edit.

Expected: the "New guard" column of the table. Then `git status --short -- apps/api/src` prints nothing.

- [ ] **Step 7: Format and lint.**

Run: `pnpm --filter api exec prettier --check test/relation-field-authorization.e2e-spec.ts test/tenant-read-authorizers.e2e-spec.ts` and `pnpm --filter api exec eslint test/relation-field-authorization.e2e-spec.ts test/tenant-read-authorizers.e2e-spec.ts`
Expected: both clean.

- [ ] **Step 8: Commit.**

```bash
git add apps/api/test/relation-field-authorization.e2e-spec.ts
git commit -m "test(api): read class-level metadata, report non-object resolver types and skip getters in the #106 metadata guard (#135)"
```

---

### Task 3: Run the API e2e suites in CI (#106 M10 observation 1)

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Inspect the live `release-gate` job.** It is the source of truth for parity, so read it in `.github/workflows/ci.yml` before writing anything:

  - `runs-on`;
  - `env`: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, and anything added since `0e50831`;
  - the `postgres` service: image, env, ports, health check;
  - the steps, in order: checkout, `pnpm/action-setup` (pnpm comes from the root `packageManager`), `setup-node` (version and cache), `pnpm install --frozen-lockfile`, `pnpm --filter api migration:run`;
  - any `working-directory` or `defaults`.

  At `0e50831` none of those carry anything the YAML in Step 2 doesn't. If the live job has changed, copy the live job instead, and change only the job id, `name`, the comment and the last `run`.

- [ ] **Step 2: Append the job.** At the end of `jobs:` (after the `release-gate` job's last step), append the `release-gate` job copied from Step 1 with these differences: job id `api-e2e`, `name: API e2e`, the comment below, and the last step. At `0e50831` the result is exactly:

```yaml

  api-e2e:
    # #135: every API e2e suite except the release gate, which keeps its own
    # job above. The #90 / #106 guard suites run here, so a field added
    # without being classified fails CI instead of only local runs. Not a
    # required status check: `main` has no branch protection, and making
    # this check required is a separate decision.
    name: API e2e
    runs-on: ubuntu-latest
    env:
      DB_HOST: localhost
      DB_PORT: 5432
      DB_USERNAME: clensy
      DB_PASSWORD: clensy_ci
      DB_NAME: clensy
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: clensy
          POSTGRES_PASSWORD: clensy_ci
          POSTGRES_DB: clensy
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U clensy -d clensy"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm --filter api migration:run

      - run: pnpm --filter api test:e2e --testPathIgnorePatterns two-tenant-release-gate
```

The workflow's existing triggers (`push` to `main`, `pull_request`) apply unchanged. Each job has its own service container, so the two database jobs don't share state.

- [ ] **Step 3: Check parity mechanically.** Run from the repository root:

```bash
python3 - <<'EOF'
import yaml
j = yaml.safe_load(open('.github/workflows/ci.yml'))['jobs']
print(list(j))
g, e = j['release-gate'], j['api-e2e']
for k in sorted((set(g) | set(e)) - {'name', 'steps'}):
    print(k, 'same' if g.get(k) == e.get(k) else 'DIFF')
print('steps[:-1]', 'same' if g['steps'][:-1] == e['steps'][:-1] else 'DIFF')
print(g['name'], '|', g['steps'][-1]['run'])
print(e['name'], '|', e['steps'][-1]['run'])
EOF
```

Expected:
- `['lint', 'test', 'release-gate', 'api-e2e']`;
- `env`, `runs-on`, `services` and `steps[:-1]` all `same`, with no `DIFF`;
- `Release gate | pnpm --filter api test:e2e:release-gate`;
- `API e2e | pnpm --filter api test:e2e --testPathIgnorePatterns two-tenant-release-gate`.

- [ ] **Step 4: Check that the release gate is excluded, and run locally.**

Run: `diff <(pnpm --filter api test:e2e --listTests | grep e2e-spec | sort) <(pnpm --filter api test:e2e --testPathIgnorePatterns two-tenant-release-gate --listTests | grep e2e-spec | sort)`
Expected: exactly one removed line, ending in `test/two-tenant-release-gate.e2e-spec.ts`.

Run: `pnpm --filter api test:e2e --testPathIgnorePatterns two-tenant-release-gate`
Expected: every suite passes, and none of them is `two-tenant-release-gate.e2e-spec.ts`.

- [ ] **Step 5: Commit.**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run the API e2e suites, release gate excepted, in a new API e2e job (#135)"
```

---

## Final verification (before the M6 handoff report)

The acceptance criteria are semantic. Counts are recorded in the M6 record, not asserted here.

- [ ] `pnpm --filter api test:e2e` — every suite passes. There is no known baseline failure any more.
- [ ] `pnpm --filter api exec tsc --noEmit` — clean.
- [ ] `pnpm run lint` — exit 0.
- [ ] `pnpm --filter api test` — every unit test passes.
- [ ] `git status --short` — prints nothing, so no mutation or scratch file is left.
- [ ] `git diff --stat main` — the only files changed are the two e2e suites, `.github/workflows/ci.yml` and this plan.
- [ ] Push the branch and open the #135 PR. CI's `Lint`, `Test`, `Release gate` and the new `API e2e` jobs all pass on the PR head. `API e2e` is the job's first real run, and it is part of M6's evidence. In that job's log, check that the passing suites do not include `two-tenant-release-gate.e2e-spec.ts`.

## Traceability

| Task | Accepted source |
| --- | --- |
| 1 | RFC §4.5 via the #90 sweep (decisions 7–8: object-field inventory and narrow allowlists with reasons); tenant-label-overrides spec §4.3 (the field and its object types) and §4.7 items 1–2 (principal's tenant only, no arguments, `null` for Super Admin) for the reasons' content |
| 2 | RFC §4.2 Required verification 7 (metadata guard, rule 6), as implemented by #106; its three Minor M6/M7 items. The runtime metadata semantics in Step 1 are existing framework and `AuthGuard` behavior, recorded here, not changed. |
| 3 | #106 M10 observation 1; a project tooling decision taken with the owner on 2026-10-06 (separate job, release gate excluded and unchanged, not required) |

## Deferred (not in this plan)

- **Making `API e2e` a required status check**, through branch protection or a ruleset. This is a separate operational decision, to be taken once the job has proven stable. It is listed as remaining work at closeout.
- **Sharding the e2e job.** Not needed at the current runtime of about 80 s.
- **Global guards in the metadata guard.** `APP_GUARD` / `useGlobalGuards` apply to every handler, so they are not a relation-level declaration, and the #106 guard has never covered them. Unchanged here.
- **Other hardening of the #90 sweep suite**, e.g. reporting every unrecognized field at once instead of stopping at the first. The masking seen in Task 1 is only a diagnostic inconvenience: the test still fails until every field is classified.

## Execution risks (operational only)

- **First CI run on a fresh runner.** The local fresh-DB run covers migrations and data, but not runner-specific timing. A suite with a tight timeout could be flaky on a slower runner. Any CI-only failure is investigated at M6, not papered over with `continue-on-error`.
- **Shared local e2e database.** The suites build and remove their own fixtures. A crashed local run may leave rows behind; the release-gate fixtures already roll back on a failed build.
- **Temporary mutations.** They live only in the two named `src` files and are reverted by a two-file checkout. Final verification's `git status --short` catches a mutation left behind.

## Gate outcomes

*(M5–M10 records are appended here.)*
