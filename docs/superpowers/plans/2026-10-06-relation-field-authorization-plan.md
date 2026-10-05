# Relation-Field Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Accepted |
| M5 decision | **Accepted** — 2026-10-06, at `41b827d`, by the owner, on the second pass, with no further revision. Execution: native (inline). The pre-existing `tenant-read-authorizers.e2e-spec.ts` failure stays out of #106 and is tracked as [#135](https://github.com/rexescario-dev/clensy-platform/issues/135). Failure policy for M6: a failure introduced by this implementation is a blocker. The unchanged #135 baseline failure is not a blocker. A new failure in the characterization suite or in any previously passing suite means stop and investigate. |
| Date | 2026-10-06 |
| M5 history | First pass (2026-10-06) returned seven required changes, all applied without changing the approach. (1) "No runtime change" is replaced by "no intended application behavior change; the implementation removes non-executing relation metadata". (2–3) Required verification 5 no longer reads as if the spec prescribes SQL capture. The SQL test is described as string-level, implementation-level evidence, with the composite FKs as the structural guarantee. (4) The rule 8 row now says there is no executable verification. (5) The metadata guard is scoped to live `@ResolveField()` handlers and is not claimed to be exhaustive. (6) RED/GREEN expectations are semantic, not test counts. (7) Task 1 is "implementation and executable tests", including the three production comments; Task 2 is the existing suites' traceability comments only. The embedded suite changed only in three comments; it was re-linted and re-run after the change (see Pre-validation). |
| Tracking issue | [#106](https://github.com/rexescario-dev/clensy-platform/issues/106). Program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81). Surfaced by #85 and #90. |
| Scope | `apps/api` only. Eight presentation type files, three comments in `src`, one new e2e suite, and comment updates in three existing e2e suites. No change to `apps/web`, `packages/*`, migrations, `schema.gql` or role matrices. No intended application behavior change for currently reachable relation fields. |
| Implements (Accepted) | [Multi-Tenant Architecture](../specs/2026-09-23-multi-tenant-architecture-design.md), **§4.2 relation-field authorization amendment (#106)**, Status **Accepted** (M3, 2026-10-06; recorded at `71d505e`, drafted at `05d45b5`). The amended parts are §3 (*root operation*, *relation field*), §4.2 "Relation-field authorization" rules 1–8 and Required verification 1–7, §4.9 (two examples), §5 invariants 15–17, §7, §8, §9 criterion 6 and §10. |
| Relies on (Accepted) | The remainder of the same RFC, unchanged, especially §4.4 (same-tenant composite FKs) and §4.5 (tenant predicate on relation resolvers). The #92 release-gate fixtures (`test/release-gate/two-tenant-world.ts`, `client.ts`) and `test/helpers/capture-sql.ts`, used as they are. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. File names, test names, helper names, comment wording and task order are planning decisions, not product semantics. |
| Edit anchors | Every edit is located by **quoted code**, not by line number. The branch base is `35c6118` (`main`). The spec commits on top of it touch no code. |

**Goal:** Deliver the #106 amendment. The relation-field authorization model (the root operation authorizes; relation fields re-apply the tenant predicate; no relation-level guards or `@Roles()`) is pinned by executable tests, and every dead relation-level `guards` / `decorators: [Roles(…)]` declaration is removed so the code no longer reads as target-role enforcement.

**Architecture:** No intended application behavior change for currently reachable relation fields. The implementation removes relation-level authorization metadata that never executes, so the code matches the accepted policy. That is a deliberate change to resolver metadata and to what any future enhancer configuration would pick up, not a no-op. `fieldResolverEnhancers: ['interceptors']` (in `graphql.module.ts`) already means guards never run on field resolvers. So:

- removing the 14 relation-level `AuthGuard` / `@Roles()` declarations changes resolver metadata and leaves the existing runtime behavior unchanged;
- the runtime tests are **characterization tests**: they pin behavior that already holds (spec Required verification 1–6);
- the only test that is RED before the change is the metadata guard (Required verification 7). It inventories the live `@ResolveField()` handlers whose schema field is object-typed, and requires that none carries guards or `@Roles()` metadata. That inventory includes the resolver methods nestjs-query generates for relations: the RED list in Task 1 Step 2 is entirely generated methods. It is not claimed to be exhaustive over the RFC's *relation field* definition. Generated relation configuration is also covered by the explicit source edits (Steps 3–4) and by the characterization tests.

**Tech Stack:** NestJS 11, `@nestjs/graphql` + Apollo, `@ptc-org/nestjs-query-graphql` 9.5.0, TypeORM, PostgreSQL 16, Jest e2e (`apps/api/test/jest-e2e.json`) with supertest.

**Pre-validation (full).** On 2026-10-06, before M5, Task 1's suite and source edits and Task 2's comment edits were applied to a working tree at `71d505e`. Every command named by an `Expected:` line below was run with the stated result, including the planned RED state (1 failed, 19 passed). The tree was then reverted. Commands run:

- `pnpm --filter api exec jest --config test/jest-e2e.json test/relation-field-authorization.e2e-spec.ts` (RED: only the metadata guard failed, listing exactly the 14 owners in Task 1 Step 2, with 19 tests passing; then GREEN: all 20 passed)
- `pnpm --filter api exec tsc --noEmit -p tsconfig.json`
- `pnpm --filter api exec eslint "src/**/*.ts" "test/**/*.ts"`
- `pnpm --filter api test` (73 suites, 987 tests passed)
- `pnpm --filter api test:e2e` (48/49 suites, 457/458 tests; the one failure is the **Known baseline failure**). This full run was made with Task 1 applied, before Task 2's comment-only edits and one comment-only rewording in `graphql.module.ts`. After those edits, `tsc`, `eslint`, and the three suites Task 2 touches were re-run with the results stated in Task 2 Step 2.
- `git diff --stat main -- apps/api/src/schema.gql apps/web packages apps/api/src/migrations`
- After the first M5 pass changed three comments in the embedded suite, the suite was re-extracted verbatim from this plan. It was re-linted (`eslint` on the file: clean), and re-run against `main` source (RED: only the metadata guard failed) and with Task 1's source edits applied (`tsc` clean; GREEN: all tests passed). The tree was then reverted.

**Known baseline failure (not introduced here).** On `main` (`35c6118`), `pnpm --filter api test:e2e` already fails one test: `tenant-read-authorizers.e2e-spec.ts` › "accounts for every object-typed field", for `CurrentAdmin.tenantLabelOverrides`. #118 / PR #128 added that field without adding it to that suite's `CUSTOM_OBJECT_FIELDS` allowlist. At pre-validation the baseline was 437/438 tests passing, and 457/458 with this plan applied (all new tests pass). Those counts are a record, not acceptance criteria. Fixing that allowlist is outside the #106 spec. This plan does **not** change it. M5 decided to track it separately as [#135](https://github.com/rexescario-dev/clensy-platform/issues/135).

## Global Constraints

These come from the Accepted spec. Every task's requirements implicitly include this section.

- The root operation is the unit of role authorization. Relation fields MUST NOT re-authorize against the target type's root roles or the parent type's roles (§4.2 rule 1, invariant 15).
- No relation field may declare relation-level `guards`, relation-level `decorators: [Roles(…)]`, or any equivalent per-relation role check (§4.2 rule 6, invariant 15).
- Every relation field, generated or hand-written, applies the tenant predicate to every row it returns. Relation filter, sort and paging arguments cannot weaken or bypass it (§4.2 rules 2, 4, 5; invariant 16).
- Root operations keep their own `@Roles()` lists. No root matrix changes (§4.2 rule 7, invariant 17).
- Cross-tenant relation isolation is proven with the strongest practical test under composite FKs. The proof MUST NOT weaken the schema (Required verification 5).
- No web changes (§4.2, "No web changes are required by this amendment").
- Out of scope: per-role redaction of a related type's fields (§10).

## Review Focus

1. **A vacuous metadata guard.** The guard inventories live `@ResolveField()` handlers. If it found none, or only one kind, an empty violation list would pass. Task 1 pins five sentinels that span both kinds: `Booking.team`, `Invoice.customer` and `Customer.properties` (generated), plus `CleaningJob.team` and `Cleaner.team` (hand-written). Pre-validation found a real trap here: a hand-written `@ResolveField(() => TeamType)` with no explicit name stores `undefined` as its field name, and Nest falls back to the method name. The helper does the same (`?? key`). Without that fallback, the hand-written relations silently dropped out.
2. **Over-reading the SQL-capture test.** The test keeps only SELECTs `from "<target table>"` and requires at least one. It asserts that each statement's text, including TypeORM's `-- PARAMETERS: [...]` suffix, contains `"tenantId"` and tenant A's id, and does not contain tenant B's id. This is a string-level check. It shows that representative relation target queries contain a tenant predicate and are parameterized with the principal's tenant. It does not bind the id to a particular placeholder, and on its own it does not prove that a cross-tenant row is impossible at the database level; the same-tenant composite FKs (§4.4) remain the structural guarantee. It covers a nestjs-query relation (`invoice.customer`, `booking.team`) and the hand-written loader (`job.team`).
3. **A relation filter acting as a separate authorization path.** Tenant B's FINANCE filters `invoices` by tenant A's customer, and `jobs` by tenant A's booking. Both return `{ nodes: [] }` with no error (rule 4).
4. **Nesting depth and mutation returns.** `job → booking → customer → properties` (rule 1 at depth) and `markLaundryOrderAwaitingPayment { customer }` as FINANCE (rule 3) are both pinned. Neither appears in the spec's numbered list, but both follow from rules 1 and 3.
5. **Root denial drift.** The eight FINANCE / CUSTOMER_SUPPORT root reads in Required verification 6 must each return exactly one `FORBIDDEN` error. This pins that removing relation declarations widened nothing.

---

## File Map

| File | Change | Task |
| --- | --- | --- |
| `apps/api/test/relation-field-authorization.e2e-spec.ts` | Create: the #106 suite (Required verification 1–7) | 1 |
| `apps/api/src/modules/bookings/presentation/graphql/booking.dto.ts` | `relationReadOpts`: drop `decorators` / `guards`, add comment; drop `Roles` / `AuthGuard` imports | 1 |
| `apps/api/src/modules/jobs/presentation/graphql/cleaning-job.type.ts` | Same as `booking.dto.ts` | 1 |
| `apps/api/src/modules/billing/presentation/graphql/invoice.type.ts` | Same, plus the `lines` `@OffsetConnection` | 1 |
| `apps/api/src/modules/laundry/presentation/graphql/laundry-order.type.ts` | Same, plus the `lines` `@OffsetConnection` | 1 |
| `apps/api/src/modules/customers/presentation/graphql/customer.type.ts` | `properties` `@OffsetConnection`: drop `decorators` / `guards`; drop `Roles` / `AuthGuard` imports (`VIEW_ROLES` stays: `customer-read.resolver.ts` imports it) | 1 |
| `apps/api/src/modules/customers/presentation/graphql/property.type.ts` | `bookings` `@OffsetConnection`: drop `decorators` / `guards`; delete the now-unused `BOOKING_VIEW_ROLES` and the `Roles` / `Role` / `AuthGuard` imports | 1 |
| `apps/api/src/modules/cleaners/presentation/graphql/team.type.ts` | `cleaners` `@OffsetConnection`: same; delete the now-unused local `VIEW_ROLES` | 1 |
| `apps/api/src/modules/jobs/presentation/graphql/checklist.type.ts` | `items` `@OffsetConnection`: same; delete the now-unused local `VIEW_ROLES` | 1 |
| `apps/api/src/modules/billing/presentation/graphql/invoice-read.resolver.ts` | Comment: root entry points are guarded; relations are authorized by the root | 1 |
| `apps/api/src/modules/catalog/presentation/graphql/service.resolver.ts` | Comment on `activePricing`: cite RFC §4.2 relation-field rules | 1 |
| `apps/api/src/platform/graphql/graphql.module.ts` | Comment on `fieldResolverEnhancers`: cite RFC §4.2 relation-field rules | 1 |
| `apps/api/test/tenant-read-authorizers.e2e-spec.ts` | Header comment: relation-field authorization is now covered by the #106 suite | 2 |
| `apps/api/test/root-operation-authorization.e2e-spec.ts` | Same | 2 |
| `apps/api/test/two-tenant-release-gate.e2e-spec.ts` | Same ("Out of scope" line) | 2 |

**Untouched:** the hand-written relation resolvers (`JobResolver.team` / `.checklist`, `CleanerResolver.team`, `ServiceResolver.activePricing`) already declare no guards or roles; only one comment changes. Also untouched: every root resolver, `role-matrix.ts`, `root-operation-inventory.ts`, `apps/web`, `packages/*`, migrations and `schema.gql`.

**Environment:** the e2e suites need the e2e Postgres. Locally: `docker compose up -d postgres`, then `pnpm --filter api migration:run`.

---

### Task 1: Implementation and executable tests

The relation-field authorization suite, removal of the non-executing relation declarations, and the three production comments that explain the change. Task 2 holds only the existing suites' traceability comments.

Spec: §4.2 relation-field rules 1–7, Required verification 1–7; §5 invariants 15–17.

**Files:**
- Create: `apps/api/test/relation-field-authorization.e2e-spec.ts`
- Modify: the eight type files and three comment sites listed in the File Map (Task 1 rows)

**Interfaces:**
- Consumes: `buildGateWorld` / `destroyGateWorld` / `GateWorld` (`test/release-gate/two-tenant-world.ts`): two tenants with every `TENANT_ROLES` principal logged in (`world.a.cookies[Role.X]`) and one customer, property, team, booking (with team), job (with team), invoice and laundry order each. `world.fixtures.laundryOrder(tenantWorld, status)` creates a priced order. `GateClient` (`test/release-gate/client.ts`) is used only for its `login`. `withCapturedSql(dataSource, run)` (`test/helpers/capture-sql.ts`) returns `{ queries, result }`, and its SQL strings include TypeORM's `-- PARAMETERS: [...]` suffix.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Write the suite**

Create `apps/api/test/relation-field-authorization.e2e-spec.ts` with exactly this content:

```ts
import { INestApplication } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import {
  GraphQLSchemaHost,
  RESOLVER_NAME_METADATA,
  RESOLVER_PROPERTY_METADATA,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { getNamedType, GraphQLObjectType, isObjectType } from 'graphql';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { LaundryOrderStatus } from '../src/modules/laundry/domain/laundry-order-status';
import { ROLES_KEY } from '../src/platform/auth/decorators/roles.decorator';
import { Role } from '../src/platform/auth/domain/role';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import { withCapturedSql } from './helpers/capture-sql';
import { GateClient } from './release-gate/client';
import {
  buildGateWorld,
  destroyGateWorld,
  GateWorld,
} from './release-gate/two-tenant-world';

// #106 relation-field authorization (multi-tenant RFC §4.2 "Relation-field
// authorization", rules 1–8 and Required verification 1–7). The root
// operation is the unit of role authorization: a relation field is
// authorized by the root operation that reaches it, never by the target
// type's root roles, and it re-applies the tenant predicate. Items 1–6 pin
// behavior that already holds (characterization); item 7 is the metadata
// guard against relation-level guards / @Roles() on live @ResolveField()
// handlers.

interface GraphqlBody {
  data?: Record<string, unknown> | null;
  errors?: { extensions?: { code?: string }; message?: string }[];
}

interface FieldResolverRecord {
  field: string;
  guards: unknown[];
  owner: string;
  roles: Role[] | undefined;
}

describe('Relation-field authorization (#106, RFC §4.2)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let world: GateWorld;

  async function gql(
    cookie: string,
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<GraphqlBody> {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query, variables });
    return response.body as GraphqlBody;
  }

  function errorCodes(body: GraphqlBody): (string | undefined)[] {
    return (body.errors ?? []).map((error) => error.extensions?.code);
  }

  // Every live @ResolveField() handler whose schema field is
  // object-typed, read from the metadata Nest and nestjs-query attach to
  // the method. This includes the methods nestjs-query generates for
  // relations. It is not claimed to be exhaustive over the RFC §3
  // relation-field definition.
  function objectFieldResolvers(): FieldResolverRecord[] {
    const { schema } = app.get(GraphQLSchemaHost);
    const records: FieldResolverRecord[] = [];
    for (const wrapper of app.get(DiscoveryService).getProviders()) {
      const instance = wrapper.instance as object | undefined;
      if (typeof instance !== 'object' || instance === null) continue;
      const resolverClass = instance.constructor;
      const typeName = Reflect.getMetadata(
        RESOLVER_NAME_METADATA,
        resolverClass,
      ) as string | undefined;
      const parentType = typeName ? schema.getType(typeName) : undefined;
      if (!isObjectType(parentType)) continue;
      const seen = new Set<string>();
      for (
        let proto = Object.getPrototypeOf(instance) as object | null;
        proto && proto !== Object.prototype;
        proto = Object.getPrototypeOf(proto) as object | null
      ) {
        for (const key of Object.getOwnPropertyNames(proto)) {
          if (seen.has(key)) continue;
          const handler = (proto as Record<string, unknown>)[key];
          if (typeof handler !== 'function') continue;
          if (Reflect.getMetadata(RESOLVER_PROPERTY_METADATA, handler) !== true)
            continue;
          seen.add(key);
          // `@ResolveField()` without an explicit name stores `undefined`;
          // Nest then uses the method name, as here.
          const field =
            (Reflect.getMetadata(RESOLVER_NAME_METADATA, handler) as
              string | undefined) ?? key;
          const schemaField = (parentType as GraphQLObjectType).getFields()[
            field
          ];
          if (!schemaField || !isObjectType(getNamedType(schemaField.type)))
            continue;
          records.push({
            field: `${typeName}.${field}`,
            guards:
              (Reflect.getMetadata(GUARDS_METADATA, handler) as
                unknown[] | undefined) ?? [],
            owner: `${resolverClass.name}.${key}`,
            roles: Reflect.getMetadata(ROLES_KEY, handler) as
              Role[] | undefined,
          });
        }
      }
    }
    return records;
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule, DiscoveryModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    applyPlatformPipes(app);
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    world = await buildGateWorld(dataSource, new GateClient(app));
  }, 120_000);

  afterAll(async () => {
    try {
      if (dataSource) await destroyGateWorld(dataSource, world);
    } finally {
      await app?.close();
    }
  });

  // Required verification 1 (rule 1).
  it('FINANCE reads invoice.customer through the invoice root operation', async () => {
    const body = await gql(
      world.a.cookies[Role.FINANCE],
      `query ($id: ID!) { invoice(id: $id) { id customer { id fullName email } } }`,
      { id: world.a.invoiceId },
    );
    expect(body.errors).toBeUndefined();
    expect(body.data?.invoice).toMatchObject({
      id: world.a.invoiceId,
      customer: { id: world.a.customerId },
    });
  });

  // Required verification 2 (rule 1).
  it('FINANCE reads booking.customer, .property and .team through the booking root operation', async () => {
    const body = await gql(
      world.a.cookies[Role.FINANCE],
      `query ($id: ID!) { booking(id: $id) { id customer { id } property { id } team { id } } }`,
      { id: world.a.bookingId },
    );
    expect(body.errors).toBeUndefined();
    expect(body.data?.booking).toEqual({
      id: world.a.bookingId,
      customer: { id: world.a.customerId },
      property: { id: world.a.propertyId },
      team: { id: world.a.teamId },
    });
  });

  // Required verification 3 (rule 1).
  it('CUSTOMER_SUPPORT reads booking.team through the booking root operation', async () => {
    const body = await gql(
      world.a.cookies[Role.CUSTOMER_SUPPORT],
      `query ($id: ID!) { booking(id: $id) { id team { id name } } }`,
      { id: world.a.bookingId },
    );
    expect(body.errors).toBeUndefined();
    expect(body.data?.booking).toMatchObject({ team: { id: world.a.teamId } });
  });

  // Required verification 4 (rule 5: hand-written relation field).
  it.each([Role.FINANCE, Role.CUSTOMER_SUPPORT])(
    '%s reads the hand-written job.team through the job root operation',
    async (role) => {
      const body = await gql(
        world.a.cookies[role],
        `query ($id: ID!) { job(id: $id) { id team { id } } }`,
        { id: world.a.jobId },
      );
      expect(body.errors).toBeUndefined();
      expect(body.data?.job).toEqual({
        id: world.a.jobId,
        team: { id: world.a.teamId },
      });
    },
  );

  // Rule 1 at depth: job -> booking -> customer -> properties, none of
  // whose target types FINANCE can read at root.
  it('FINANCE reads nested relations at any depth under the job root operation', async () => {
    const body = await gql(
      world.a.cookies[Role.FINANCE],
      `query ($id: ID!) { job(id: $id) { booking { customer { id properties { nodes { id } } } } } }`,
      { id: world.a.jobId },
    );
    expect(body.errors).toBeUndefined();
    expect(body.data?.job).toEqual({
      booking: {
        customer: {
          id: world.a.customerId,
          properties: { nodes: [{ id: world.a.propertyId }] },
        },
      },
    });
  });

  // Rule 3: a mutation is the root operation for its returned selection.
  it('FINANCE reads customer on the return of a mutation it may call', async () => {
    const orderId = await world.fixtures.laundryOrder(
      world.a,
      LaundryOrderStatus.PRICED,
    );
    const body = await gql(
      world.a.cookies[Role.FINANCE],
      `mutation ($input: LaundryOrderRefInput!) { markLaundryOrderAwaitingPayment(input: $input) { id customer { id } } }`,
      { input: { orderId } },
    );
    expect(body.errors).toBeUndefined();
    expect(body.data?.markLaundryOrderAwaitingPayment).toEqual({
      id: orderId,
      customer: { id: world.a.customerId },
    });
  });

  // Required verification 5 (rules 2 and 4). Composite same-tenant FKs
  // (§4.4) make a stored cross-tenant reference impossible. As additional,
  // implementation-level evidence that does not weaken the schema, these
  // tests check that representative relation queries contain a tenant
  // predicate parameterized with the principal's tenant (a string-level
  // check of the logged SQL, parameters included), and that relation
  // filters cannot select another tenant's rows.
  it.each([
    [
      'invoice.customer (nestjs-query)',
      `query ($id: ID!) { invoice(id: $id) { customer { id } } }`,
      'invoiceId',
      'customer_entity',
    ],
    [
      'booking.team (nestjs-query)',
      `query ($id: ID!) { booking(id: $id) { team { id } } }`,
      'bookingId',
      'team_entity',
    ],
    [
      'job.team (hand-written loader)',
      `query ($id: ID!) { job(id: $id) { team { id } } }`,
      'jobId',
      'team_entity',
    ],
  ] as const)(
    '%s queries its target with the principal tenant predicate',
    async (_label, query, idKey, table) => {
      const { queries, result } = await withCapturedSql(dataSource, () =>
        gql(world.a.cookies[Role.FINANCE], query, { id: world.a[idKey] }),
      );
      expect(result.errors).toBeUndefined();
      const relationSelects = queries.filter(
        (sql) =>
          sql.toLowerCase().includes(`from "${table}"`) &&
          !sql.toLowerCase().startsWith('insert'),
      );
      expect(relationSelects.length).toBeGreaterThan(0);
      for (const sql of relationSelects) {
        expect({ sql, tenantPredicate: sql.includes('"tenantId"') }).toEqual({
          sql,
          tenantPredicate: true,
        });
        expect({ sql, tenantParam: sql.includes(world.a.tenantId) }).toEqual({
          sql,
          tenantParam: true,
        });
        expect({
          otherTenantParam: sql.includes(world.b.tenantId),
          sql,
        }).toEqual({ otherTenantParam: false, sql });
      }
    },
  );

  it('relation filters cannot select another tenant’s rows', async () => {
    const invoices = await gql(
      world.b.cookies[Role.FINANCE],
      `query ($customerId: ID!) { invoices(filter: { customer: { id: { eq: $customerId } } }) { nodes { id } } }`,
      { customerId: world.a.customerId },
    );
    expect(invoices.errors).toBeUndefined();
    expect(invoices.data?.invoices).toEqual({ nodes: [] });
    const jobs = await gql(
      world.b.cookies[Role.FINANCE],
      `query ($bookingId: ID!) { jobs(filter: { booking: { id: { eq: $bookingId } } }) { nodes { id } } }`,
      { bookingId: world.a.bookingId },
    );
    expect(jobs.errors).toBeUndefined();
    expect(jobs.data?.jobs).toEqual({ nodes: [] });
  });

  // Required verification 6 (rule 7): relation reach does not widen root
  // access.
  it.each([
    [Role.FINANCE, `query { customers { nodes { id } } }`, {}],
    [
      Role.FINANCE,
      `query ($id: ID!) { customer(id: $id) { id } }`,
      'customerId',
    ],
    [
      Role.FINANCE,
      `query ($id: ID!) { customerProperties(customerId: $id) { nodes { id } } }`,
      'customerId',
    ],
    [
      Role.FINANCE,
      `query ($id: ID!) { property(id: $id) { id } }`,
      'propertyId',
    ],
    [Role.FINANCE, `query { teams { nodes { id } } }`, {}],
    [Role.FINANCE, `query ($id: ID!) { team(id: $id) { id } }`, 'teamId'],
    [Role.CUSTOMER_SUPPORT, `query { teams { nodes { id } } }`, {}],
    [
      Role.CUSTOMER_SUPPORT,
      `query ($id: ID!) { team(id: $id) { id } }`,
      'teamId',
    ],
  ] as const)('%s stays Forbidden on root %s', async (role, query, idKey) => {
    const variables = typeof idKey === 'string' ? { id: world.a[idKey] } : {};
    const body = await gql(world.a.cookies[role], query, variables);
    expect(errorCodes(body)).toEqual(['FORBIDDEN']);
  });

  // Required verification 7 (rule 6).
  it('declares no guards or @Roles() on any relation field resolver', () => {
    const records = objectFieldResolvers();
    // Sentinels: both resolver kinds are inventoried, so an empty or
    // one-sided inventory cannot pass vacuously.
    expect(records.map((r) => r.field)).toEqual(
      expect.arrayContaining([
        'Booking.team',
        'CleaningJob.team',
        'Cleaner.team',
        'Invoice.customer',
        'Customer.properties',
      ]),
    );
    expect(
      records
        .filter((r) => r.guards.length > 0 || r.roles !== undefined)
        .map((r) => r.owner)
        .sort(),
    ).toEqual([]);
  });
});
```

What each test verifies:

| Test | Spec | Kind |
| --- | --- | --- |
| FINANCE `invoice.customer` | Required verification 1; rule 1 | Characterization |
| FINANCE `booking.customer` / `.property` / `.team` | Required verification 2; rule 1 | Characterization |
| CUSTOMER_SUPPORT `booking.team` | Required verification 3; rule 1 | Characterization |
| FINANCE and CUSTOMER_SUPPORT hand-written `job.team` | Required verification 4; rule 5 | Characterization |
| FINANCE `job → booking → customer → properties` | Rule 1 (any depth) | Characterization |
| FINANCE `markLaundryOrderAwaitingPayment { customer }` | Rule 3 | Characterization |
| SQL of `invoice.customer`, `booking.team`, `job.team` contains a tenant predicate parameterized with tenant A, never tenant B (implementation-level evidence) | Required verification 5; rule 2 | Characterization |
| Tenant B's relation filters on tenant A's ids return no rows | Required verification 5; rule 4 | Characterization |

**Required verification 5.** Same-tenant composite FKs (§4.4) make a stored cross-tenant reference impossible. In addition, the suite verifies the tenant predicate on representative relation queries, and verifies that relation filters cannot select another tenant's rows. These tests provide implementation-level evidence without weakening the schema. The spec does not prescribe SQL capture as the mechanism; it is this plan's choice.
| Eight root reads stay `FORBIDDEN` | Required verification 6; rule 7 | Characterization |
| No relation field resolver carries guards or `@Roles()` | Required verification 7; rule 6 | **RED → GREEN** |

- [ ] **Step 2: Run the suite and verify the RED state**

Run: `pnpm --filter api exec jest --config test/jest-e2e.json test/relation-field-authorization.e2e-spec.ts`

Expected: the metadata-guard test ("declares no guards or @Roles() on any relation field resolver") fails, and every characterization test passes. The violation list must contain exactly these 14 owners:

```text
BookingReadResolver.findCustomer
BookingReadResolver.findProperty
BookingReadResolver.findService
BookingReadResolver.findTeam
ChecklistReadResolver.queryItems
CustomerReadResolver.queryProperties
InvoiceReadResolver.findCustomer
InvoiceReadResolver.findLaundryOrder
InvoiceReadResolver.queryLines
JobReadResolver.findBooking
LaundryOrderReadResolver.findCustomer
LaundryOrderReadResolver.queryLines
PropertyReadResolver.queryBookings
TeamReadResolver.queryCleaners
```

If any characterization test fails, **stop**. The current behavior differs from what the spec records. Report it rather than changing production code to match.

- [ ] **Step 3: Remove the relation-level declarations from the four `relationReadOpts` files**

In each of `booking.dto.ts`, `cleaning-job.type.ts`, `invoice.type.ts` and `laundry-order.type.ts`, replace:

```ts
const relationReadOpts = {
  decorators: [Roles(...VIEW_ROLES)],
  guards: [AuthGuard],
  remove: { enabled: false },
  update: { enabled: false },
};
```

with:

```ts
// No relation-level guards or `@Roles()`: a relation field is authorized
// by the root operation that reaches it, and its target's authorizer
// re-applies the tenant predicate (multi-tenant RFC §4.2 relation-field
// rules, #106).
const relationReadOpts = {
  remove: { enabled: false },
  update: { enabled: false },
};
```

In the same four files, delete these two import lines. `Role` stays imported, because each file still defines its exported `VIEW_ROLES`.

```ts
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
```

- [ ] **Step 4: Remove the relation-level declarations from the six `@OffsetConnection`s**

The connections are `Invoice.lines` (`invoice.type.ts`), `LaundryOrder.lines` (`laundry-order.type.ts`), `Customer.properties` (`customer.type.ts`), `Property.bookings` (`property.type.ts`), `Team.cleaners` (`team.type.ts`) and `Checklist.items` (`checklist.type.ts`). In each one, delete the `decorators` line, which is the first option line:

```ts
  decorators: [Roles(...VIEW_ROLES)],
```

In `property.type.ts` that line reads `  decorators: [Roles(...BOOKING_VIEW_ROLES)],`. Also delete the `guards` line that follows `enableTotalCount: false,`:

```ts
  guards: [AuthGuard],
```

Then make these import and constant changes:

- `customer.type.ts`: delete the `Roles` and `AuthGuard` imports. Keep `Role` and `VIEW_ROLES`, because `customer-read.resolver.ts` imports `VIEW_ROLES`.
- `property.type.ts`: delete the `Roles`, `Role` and `AuthGuard` imports, and the whole `const BOOKING_VIEW_ROLES = [ … ];` block, which has no other use. Leave a single blank line between the imports and the `/* eslint-disable @typescript-eslint/no-require-imports` comment.
- `team.type.ts` and `checklist.type.ts`: delete the `Roles`, `Role` and `AuthGuard` imports and the local `const VIEW_ROLES = [ … ];` block. Neither is exported or used elsewhere: `checklist-read.resolver.ts` imports `VIEW_ROLES` from `cleaning-job.type`. Leave a single blank line before the next declaration.

- [ ] **Step 5: Update the three comments that described relation authorization**

`invoice-read.resolver.ts`: replace

```ts
// (the `LaundryOrderResolver.laundryOrder` precedent). Every entry point
// is guarded by `AuthGuard` + `@Roles(...VIEW_ROLES)` (spec §4.7).
```

with

```ts
// (the `LaundryOrderResolver.laundryOrder` precedent). Every root entry
// point is guarded by `AuthGuard` + `@Roles(...VIEW_ROLES)` (spec §4.7);
// the relations are authorized by the root operation that reaches them
// (multi-tenant RFC §4.2 relation-field rules, #106).
```

`service.resolver.ts` (above `activePricing`): replace

```ts
  // `@UseGuards`/`@Roles()`: reachable only after the guarded parent query
  // already succeeded, the same precedent `Cleaner.team`/`Team.cleaners`
  // established. Tenant from the principal, never from the parent row (#84
```

with

```ts
  // `@UseGuards`/`@Roles()`: a relation field is authorized by the root
  // operation that reaches it (multi-tenant RFC §4.2 relation-field rules,
  // #106). Tenant from the principal, never from the parent row (#84
```

`graphql.module.ts`: replace

```ts
      // Guards stay root-only: enabling them would re-run `AuthGuard` on
      // every relation field of every row.
```

with

```ts
      // Guards stay root-only: the root operation is the unit of role
      // authorization, and relation fields are authorized by it (RFC §4.2
      // relation-field rules, #106). nestjs-query relation fields re-apply
      // the tenant predicate through these interceptors.
```

- [ ] **Step 6: Run the suite and verify GREEN**

Run: `pnpm --filter api exec jest --config test/jest-e2e.json test/relation-field-authorization.e2e-spec.ts`
Expected: every test in the suite passes.

- [ ] **Step 7: Type-check, lint and unit tests**

Run: `pnpm --filter api exec tsc --noEmit -p tsconfig.json`
Expected: exit 0, no output.

Run: `pnpm --filter api exec eslint "src/**/*.ts" "test/**/*.ts"`
Expected: exit 0, no output. This catches any leftover unused import or constant from Steps 3–4, and enforces the repository's `contextforge/record-key-order` rule (`id` first) that the suite's object literals already follow.

Run: `pnpm --filter api test`
Expected: every unit suite passes.

- [ ] **Step 8: Commit**

```bash
git add apps/api/test/relation-field-authorization.e2e-spec.ts apps/api/src
git commit -m "feat(api): authorize relation fields by their root operation (#106)

Pins RFC §4.2 relation-field authorization with an e2e suite and removes
the relation-level AuthGuard/@Roles() declarations that never ran."
```

---

### Task 2: Traceability comments in the existing test suites

Spec: §8 traceability. This is a comment-only change. TDD does not apply; verification is lint plus a re-run of the three suites.

**Files:**
- Modify: `apps/api/test/tenant-read-authorizers.e2e-spec.ts`, `apps/api/test/root-operation-authorization.e2e-spec.ts`, `apps/api/test/two-tenant-release-gate.e2e-spec.ts`

**Interfaces:** none.

- [ ] **Step 1: Update the three header comments**

`tenant-read-authorizers.e2e-spec.ts`: replace

```ts
// prove runtime isolation (the module two-tenant suites do), relation-level
// RBAC (#106), or the scoping inside custom @Query handlers and loaders.
```

with

```ts
// prove runtime isolation (the module two-tenant suites do), relation-field
// authorization (relation-field-authorization.e2e-spec.ts, #106), or the
// scoping inside custom @Query handlers and loaders.
```

`root-operation-authorization.e2e-spec.ts`: replace

```ts
// tenant isolation (the module two-tenant suites do) and does not cover
// relation-field RBAC (#106). The classification lives in
```

with

```ts
// tenant isolation (the module two-tenant suites do) and does not cover
// relation fields, which the root operation authorizes (RFC §4.2;
// relation-field-authorization.e2e-spec.ts, #106). The classification lives in
```

`two-tenant-release-gate.e2e-spec.ts`: replace

```ts
// [enforcement] / [isolation] / [integrity] a runtime defect. Out of scope:
// relation-field RBAC (#106), UI, query counts.
```

with

```ts
// [enforcement] / [isolation] / [integrity] a runtime defect. Out of scope:
// relation-field authorization (relation-field-authorization.e2e-spec.ts,
// #106), UI, query counts.
```

- [ ] **Step 2: Lint and re-run the three suites**

Run: `pnpm --filter api exec eslint "test/**/*.ts"`
Expected: exit 0, no output.

Run: `pnpm --filter api exec jest --config test/jest-e2e.json test/root-operation-authorization.e2e-spec.ts test/two-tenant-release-gate.e2e-spec.ts`
Expected: both suites pass.

Run: `pnpm --filter api exec jest --config test/jest-e2e.json test/tenant-read-authorizers.e2e-spec.ts`
Expected: the only failure is the known baseline failure (`CurrentAdmin.tenantLabelOverrides`), unchanged from `main`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/tenant-read-authorizers.e2e-spec.ts apps/api/test/root-operation-authorization.e2e-spec.ts apps/api/test/two-tenant-release-gate.e2e-spec.ts
git commit -m "test(api): point the #90/#92 guard suites at the #106 relation suite"
```

---

## Final verification (end of M6)

Run: `pnpm --filter api test:e2e`
Expected: every suite passes except the known baseline failure in `tenant-read-authorizers.e2e-spec.ts`. Any other failure is a regression.

Run: `git diff --stat main -- apps/api/src/schema.gql apps/web packages apps/api/src/migrations`
Expected: no output. The schema, web, packages and migrations are unchanged.

## Traceability

| Spec item | Task |
| --- | --- |
| §4.2 rule 1 (root operation authorizes, any depth) | 1 (Required verification 1–4 and the depth test) |
| §4.2 rule 2 / invariant 16 (tenant predicate re-applied) | 1 (SQL-capture test) |
| §4.2 rule 3 (mutation returns) | 1 (mutation test) |
| §4.2 rule 4 (relation filters inside tenant scope) | 1 (relation-filter test) |
| §4.2 rule 5 (both resolver kinds) | 1 (hand-written `job.team` tests; guard sentinels) |
| §4.2 rule 6 / invariant 15 (no relation-level declarations) | 1 (Steps 3–4 remove the generated-relation declarations; the metadata guard checks live `@ResolveField()` handlers) |
| §4.2 rule 7 / invariant 17 (root denial intact) | 1 (eight `FORBIDDEN` tests) |
| §4.2 rule 8 (adding a relation is a policy review) | **No executable verification.** Rule 8 is a future design and review obligation: adding a relation requires an authorization-policy review against the root operations and the tenant-isolation requirements. The metadata guard enforces rule 6. It does not mechanically enforce rule 8, and it does not detect a newly added relation that carries no forbidden metadata. |
| §8 traceability | 2 |
| "No web changes" | Final verification `git diff --stat` |
| §10 deferral (per-role field redaction) | Not implemented (deferred) |

## Documentation handoff (M9, not M6)

M9 owns these. They are listed so nothing is lost; M6 does not edit them.

- `docs/README.md` "Open: relation-level role authorization (#106)": rewrite as resolved. The root operation authorizes; relation fields re-apply the tenant predicate; the suite is linked.
- `README.md` release-gate paragraph: "relation-field role checks (#106, still open)" now points at the #106 suite.
- RFC Tracking row: record this PR and the resolution once merged.

## Execution risks

- **Shared e2e database.** The suite builds a two-tenant world (12 principals) with the release-gate fixtures and removes it in `afterAll`. A crash mid-build is already cleaned up by `buildGateWorld`'s own rollback (#92 M7 finding).
- **SQL log format.** `withCapturedSql` fails loudly if TypeORM's query log format changes (it throws when nothing is captured), so the tenant-predicate test cannot pass vacuously.
