# Tenant-Read Sweep Classification, Metadata-Guard Hardening and CI e2e Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Draft |
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

**Architecture:** Test and CI changes only. The #90 sweep's mechanism is unchanged; it gains two allowlist entries, each with its reason. In the #106 suite, `objectFieldResolvers()` also reads class-level metadata, reports typed resolvers whose type is not a schema object type, and reads methods through property descriptors. The Required verification 7 test also asserts that this report is empty. The new CI job mirrors the `Release gate` job's Postgres service and steps, and runs the full e2e config minus the release-gate suite.

**Tech Stack:** NestJS 11, `@nestjs/graphql` + Apollo, `@ptc-org/nestjs-query-graphql` 9.5.0, TypeORM, PostgreSQL 16, Jest e2e (`apps/api/test/jest-e2e.json`, `maxWorkers: 1`), GitHub Actions.

**Discovered at planning time.** The issue names only `CurrentAdmin.tenantLabelOverrides`. With that one entry added, the same test still fails, now on `TenantLabelOverrides.roles`. `expect` stops at the first miss, so the first failure hid the second. #118 added both object-typed fields, so both are classified here (Task 1). With both entries, the inventory has no further unclassified field.

**Pre-validation (full).** Before M5, on 2026-10-06, every edit in Tasks 1–3 was applied verbatim to a working tree at `0e50831`. Every command named by an `Expected:` line ran with the stated result, including every mutation run in Task 2. The tree was then reverted. Commands run:

- `pnpm --filter api exec jest --config test/jest-e2e.json test/tenant-read-authorizers.e2e-spec.ts` (RED before Task 1 on `CurrentAdmin.tenantLabelOverrides`; RED on `TenantLabelOverrides.roles` with only the first entry; GREEN with both)
- `pnpm --filter api exec jest --config test/jest-e2e.json test/relation-field-authorization.e2e-spec.ts -t "declares no guards"`, under each Task 2 mutation, with the old and the new guard (results in Task 2)
- `pnpm --filter api exec jest --config test/jest-e2e.json test/relation-field-authorization.e2e-spec.ts test/tenant-read-authorizers.e2e-spec.ts` (2 suites, 29 tests passed)
- `pnpm --filter api test:e2e --testPathIgnorePatterns two-tenant-release-gate` against the local DB, and against a freshly created and migrated scratch database (`clensy_ci_probe`, dropped afterwards), as CI's fresh service DB would be. Both runs: 48 suites, 446 tests passed, about 80 s.
- `pnpm --filter api test:e2e` (49 suites, 458 tests passed)
- `pnpm --filter api exec tsc --noEmit`, `pnpm run lint` (exit 0), `pnpm --filter api test` (73 suites, 987 tests passed)
- `npx prettier --check` on both edited suites
- `python3 -c "import yaml; …"` parse of `ci.yml` (jobs: `lint`, `test`, `release-gate`, `api-e2e`)

The counts above are a record, not acceptance criteria. The acceptance criteria are semantic (Final verification).

## Global Constraints

Every task's requirements implicitly include this section.

- The #90 allowlist mechanism is unchanged. A field is either a declared nestjs-query relation or a `CUSTOM_OBJECT_FIELDS` entry with a one-line reason. The suite's stale-entry check (every entry must be live and not a declared relation) applies to the new entries (#90 decision 8).
- An allowlist reason MUST state why the field cannot expose another tenant's data, from the Accepted #118 contract: the parent `CurrentAdmin` is built only from the principal, so the field reads only the principal's own tenant's labels (tenant-label-overrides spec §4.3, §4.7 items 1–2).
- The metadata guard keeps its five sentinels (`Booking.team`, `CleaningJob.team`, `Cleaner.team`, `Invoice.customer`, `Customer.properties`), so it can't pass vacuously. Its assertion that no relation field resolver declares guards or `@Roles()` is unchanged; it only sees more (RFC §4.2 Required verification 7).
- Resolvers with no `@Resolver` type, i.e. root resolvers, are still skipped by the guard. Only a resolver that names a type that is not a schema object type is reported.
- No change to `apps/api/src`. The mutations in Task 2 are temporary and MUST be reverted before committing.
- The `Release gate` job, its name and its command (`pnpm --filter api test:e2e:release-gate`) are unchanged. The RFC's Tracking row cites that command.
- The new CI job is an ordinary check that can fail: no `continue-on-error`. #135 **creates** the check. It does **not** make it a required status check: no branch protection or ruleset change.
- The new job runs as one unsharded job.

## Review Focus

1. **Allowlist reasons.** Each reason must hold for the code as shipped. `CurrentAdminLabelOverridesResolver.tenantLabelOverrides` takes no arguments and reads `admin.tenantId` from its parent, which `toCurrentAdminType(principal)` builds (resolver header comment). It returns `null` for platform scope. `TenantLabelOverrides.roles` has no resolver of its own; it is the plain object that field returns.
2. **Guard regressions.** The hardened guard must stay green on the real code. It must not newly report a legitimate resolver, e.g. a resolver targeting an interface type, or a nestjs-query resolver with class-level guards hosting a relation. Pre-validation found none: `unresolved` is `[]` and no class-level metadata reaches a record. Each hardening is shown to catch its mutation (Task 2).
3. **CI parity.** The job must behave as the local run does on a fresh database: migrations first, the same env as `Release gate`, and the release-gate suite excluded, so it doesn't run twice.

---

## File Map

| File | Change | Task |
| --- | --- | --- |
| `apps/api/test/tenant-read-authorizers.e2e-spec.ts` | Two `CUSTOM_OBJECT_FIELDS` entries | 1 |
| `apps/api/test/relation-field-authorization.e2e-spec.ts` | `objectFieldResolvers()` hardening; Required verification 7 test also asserts no unresolved resolver types | 2 |
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
- Temporarily mutate, then restore: `apps/api/src/modules/admins/presentation/graphql/current-admin-label-overrides.resolver.ts`, `apps/api/src/modules/admins/admins.module.ts`

**TDD shape.** The guard is already green on the real code, and stays green. Each hardening closes a blind spot that no current resolver hits. So "RED" is shown with a temporary mutation of `src`, run against the **old** guard and then the **new** guard:

| Mutation (temporary, on `CurrentAdminLabelOverridesResolver`, which hosts the object-typed `CurrentAdmin.tenantLabelOverrides`) | Old guard | New guard |
| --- | --- | --- |
| M1a: class-level `@UseGuards(AuthGuard)` | passes (blind spot) | fails, listing `CurrentAdminLabelOverridesResolver.tenantLabelOverrides` |
| M1b: class-level `@Roles(Role.TENANT_OWNER)` | passes (blind spot) | fails, listing the same owner |
| M2: an extra provider `@Resolver('NoSuchType') export class ProbeResolver {}`, registered in `AdminsModule.providers` | passes (skipped silently) | fails, `unresolved` = `["ProbeResolver -> NoSuchType"]` |
| M3: a getter `get probe(): never { throw new Error('getter invoked'); }` on the class | fails loudly (`getter invoked`) | passes (the getter is never invoked) |

Every mutation run is: `pnpm --filter api exec jest --config test/jest-e2e.json test/relation-field-authorization.e2e-spec.ts -t "declares no guards"` (1 test run, 19 skipped).

- [ ] **Step 1: Show the blind spots against the old guard.** Apply each mutation in turn to the unmodified suite, run the command above, record the "Old guard" column, and revert the mutation (`git checkout -- apps/api/src`). The imports M1a/M1b need are `UseGuards` from `@nestjs/common`, `AuthGuard` from `../../../../platform/auth/guards/auth.guard`, `Roles` from `../../../../platform/auth/decorators/roles.decorator` and `Role` from `../../../../platform/auth/domain/role`. For M2, `ProbeResolver` is appended to the resolver file and imported next to `CurrentAdminLabelOverridesResolver` in `admins.module.ts`.

Expected: M1a, M1b and M2 pass; M3 fails with `getter invoked`.

- [ ] **Step 2: Harden `objectFieldResolvers()`.** In `apps/api/test/relation-field-authorization.e2e-spec.ts`:

(a) Directly below the `FieldResolverRecord` interface (after its closing `}`), insert:

```ts

interface FieldResolverInventory {
  records: FieldResolverRecord[];
  // `@Resolver(...)` classes whose type name is not a schema object type.
  unresolved: string[];
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
  // Every live @ResolveField() handler whose schema field is
  // object-typed, read from the metadata Nest and nestjs-query attach to
  // the method and its resolver class. This includes the methods
  // nestjs-query generates for relations. It is not claimed to be
  // exhaustive over the RFC §3 relation-field definition. A typed resolver
  // whose type is not a schema object type is reported, not skipped (#135).
  function objectFieldResolvers(): FieldResolverInventory {
    const { schema } = app.get(GraphQLSchemaHost);
    const records: FieldResolverRecord[] = [];
    const unresolved: string[] = [];
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
        unresolved.push(`${resolverClass.name} -> ${typeName}`);
        continue;
      }
      // Class-level @UseGuards() / @Roles() apply to every handler (#135).
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

(f) Replace the function's `    return records;` with `    return { records, unresolved };`.

(g) In the test `'declares no guards or @Roles() on any relation field resolver'`, replace

```ts
    const records = objectFieldResolvers();
```

with

```ts
    const { records, unresolved } = objectFieldResolvers();
    expect(unresolved).toEqual([]);
```

The sentinel assertion and the violation assertion below it are unchanged.

- [ ] **Step 3: GREEN on the real code.**

Run: `pnpm --filter api exec jest --config test/jest-e2e.json test/relation-field-authorization.e2e-spec.ts`
Expected: all 20 tests pass. `unresolved` is `[]`, and no class-level metadata reaches a record.

- [ ] **Step 4: Show the hardened guard catches each mutation.** Re-apply each mutation from Step 1 in turn, run the `-t "declares no guards"` command, record the "New guard" column, and revert (`git checkout -- apps/api/src`).

Expected: M1a, M1b and M2 fail with the listed values; M3 passes. Then `git status --short apps/api/src` is empty.

- [ ] **Step 5: Format and lint.**

Run: `pnpm --filter api exec prettier --check test/relation-field-authorization.e2e-spec.ts test/tenant-read-authorizers.e2e-spec.ts` and `pnpm --filter api exec eslint test/relation-field-authorization.e2e-spec.ts test/tenant-read-authorizers.e2e-spec.ts`
Expected: both clean.

- [ ] **Step 6: Commit.**

```bash
git add apps/api/test/relation-field-authorization.e2e-spec.ts
git commit -m "test(api): read class-level metadata, report unresolved resolver types and skip getters in the #106 metadata guard (#135)"
```

---

### Task 3: Run the API e2e suites in CI (#106 M10 observation 1)

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Append the job.** At the end of `jobs:` (after the `release-gate` job's last step), append:

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

- [ ] **Step 2: Verify locally.**

Run: `python3 -c "import yaml; print(list(yaml.safe_load(open('.github/workflows/ci.yml'))['jobs']))"`
Expected: `['lint', 'test', 'release-gate', 'api-e2e']`.

Run: `pnpm --filter api test:e2e --testPathIgnorePatterns two-tenant-release-gate`
Expected: every suite passes, and `two-tenant-release-gate.e2e-spec.ts` is not among them.

- [ ] **Step 3: Commit.**

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
- [ ] `git diff --stat main -- apps/api/src apps/web packages apps/api/package.json` — empty.
- [ ] Push the branch and open the #135 PR. CI's `Lint`, `Test`, `Release gate` and the new `API e2e` jobs all pass on the PR head. `API e2e` is the job's first real run, and it is part of M6's evidence.

## Traceability

| Task | Accepted source |
| --- | --- |
| 1 | RFC §4.5 via the #90 sweep (decisions 7–8: object-field inventory and narrow allowlists with reasons); tenant-label-overrides spec §4.3 (the field and its object types) and §4.7 items 1–2 (principal's tenant only, no arguments, `null` for Super Admin) for the reasons' content |
| 2 | RFC §4.2 Required verification 7 (metadata guard, rule 6), as implemented by #106; its three Minor M6/M7 items |
| 3 | #106 M10 observation 1; a project tooling decision taken with the owner on 2026-10-06 (separate job, release gate excluded and unchanged, not required) |

## Deferred (not in this plan)

- **Making `API e2e` a required status check**, through branch protection or a ruleset. This is a separate operational decision, to be taken once the job has proven stable. It is listed as remaining work at closeout.
- **Sharding the e2e job.** Not needed at the current runtime of about 80 s.
- **Other hardening of the #90 sweep suite**, e.g. reporting every unrecognized field at once instead of stopping at the first. The masking seen in Task 1 is only a diagnostic inconvenience: the test still fails until every field is classified.

## Execution risks (operational only)

- **First CI run on a fresh runner.** The local fresh-DB run covers migrations and data, but not runner-specific timing. A suite with a tight timeout could be flaky on a slower runner. Any CI-only failure is investigated at M6, not papered over with `continue-on-error`.
- **Shared local e2e database.** The suites build and remove their own fixtures. A crashed local run may leave rows behind; the release-gate fixtures already roll back on a failed build.

## Gate outcomes

*(M5–M10 records are appended here.)*
