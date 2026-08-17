import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { AdminUserEntity } from '../src/modules/admins/infrastructure/persistence/admin-user.entity';
import { PricingRulesService } from '../src/modules/catalog/application/services/pricing-rules.service';
import { PricingRuleEntity } from '../src/modules/catalog/infrastructure/persistence/pricing-rule.entity';
import { Role } from '../src/platform/auth/domain/role';
import { seedOwner } from './helpers/seed-owner';

// Proves plan task-7 brief's full 11-step Catalog E2E acceptance scenario
// end-to-end: real HTTP (supertest) against the real `AppModule` (full
// composition root — GraphQL, auth guard/strategy, Service/AddOn/
// PricingRule services, request-scoped `ActivePricingLoader`, audit logger)
// and a real Postgres connection. This is a black-box proof of the
// resolver -> guard -> service -> loader -> database wiring; it deliberately
// does NOT re-prove what Tasks 1-3's level-2 real-Postgres service tests
// (`catalog.service.e2e-spec.ts`) already cover (explicit-`null`-vs-omitted
// persistence, audit-failure rollback, unique-constraint translation, the
// concurrency race) at the service layer.
//
// Self-contained, following `cleaners-teams.e2e-spec.ts`'s exact precedent:
// seeds its own Owner via `helpers/seed-owner.ts`, creates its own
// Scheduler/Customer Support/Finance/Analyst admins rather than depending on
// any other suite's fixtures or execution order, uses unique-per-run data
// (interpolating the seeded Owner's id), and scopes every assertion to
// specific returned ids rather than exact counts/global truncation — which
// is what makes it safe to run against the same, non-truncated, real
// Postgres database as every other suite without needing the advisory-lock
// helper `catalog.service.e2e-spec.ts` uses.
//
// No GraphQL query exposes audit events (matching Admin Foundation/Cleaners
// & Teams precedent) — every audit assertion below reads `AuditEventEntity`
// directly via a repository pulled off the same `TestingModule`, never
// through a query this suite invents.
describe('Catalog (e2e)', () => {
  let app: INestApplication<App>;
  let adminUserRepository: Repository<AdminUserEntity>;
  let auditEventRepository: Repository<AuditEventEntity>;
  let pricingRuleRepository: Repository<PricingRuleEntity>;
  let pricingRulesService: PricingRulesService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirrors main.ts's bootstrap(), which this test doesn't go through.
    // `cookie-parser` is required here specifically: `JwtStrategy`'s cookie
    // extractor reads `req.cookies[SESSION_COOKIE_NAME]`, which is only
    // populated when this middleware runs ahead of it.
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    adminUserRepository = moduleFixture.get(
      getRepositoryToken(AdminUserEntity),
    );
    auditEventRepository = moduleFixture.get(
      getRepositoryToken(AuditEventEntity),
    );
    pricingRuleRepository = moduleFixture.get(
      getRepositoryToken(PricingRuleEntity),
    );
    pricingRulesService = moduleFixture.get(PricingRulesService);
  });

  afterAll(async () => {
    await app.close();
  });

  const LOGIN_MUTATION = `
    mutation Login($input: LoginInput!) {
      login(loginInput: $input) {
        success
        admin { id role }
      }
    }
  `;

  const CREATE_ADMIN_MUTATION = `
    mutation CreateAdmin($input: CreateAdminInput!) {
      createAdmin(createAdminInput: $input) {
        id
        email
        role
        isActive
      }
    }
  `;

  const CREATE_SERVICE_MUTATION = `
    mutation CreateService($input: CreateServiceInput!) {
      createService(input: $input) {
        id
        name
        description
        durationMinutes
        active
      }
    }
  `;

  const UPDATE_SERVICE_MUTATION = `
    mutation UpdateService($id: ID!, $input: UpdateServiceInput!) {
      updateService(id: $id, input: $input) {
        id
        name
        description
        durationMinutes
        active
      }
    }
  `;

  const CREATE_ADD_ON_MUTATION = `
    mutation CreateAddOn($input: CreateAddOnInput!) {
      createAddOn(input: $input) {
        id
        name
        description
        priceMinorUnits
        active
      }
    }
  `;

  const UPDATE_ADD_ON_MUTATION = `
    mutation UpdateAddOn($id: ID!, $input: UpdateAddOnInput!) {
      updateAddOn(id: $id, input: $input) {
        id
        name
        description
        priceMinorUnits
        active
      }
    }
  `;

  const CREATE_PRICING_RULE_MUTATION = `
    mutation CreatePricingRule($input: CreatePricingRuleInput!) {
      createPricingRule(input: $input) {
        id
        serviceId
        priceMinorUnits
      }
    }
  `;

  const SERVICES_QUERY = `
    query Services {
      services {
        id
        name
        active
        activePricing { priceMinorUnits }
      }
    }
  `;

  const ADD_ONS_QUERY = `
    query AddOns {
      addOns {
        id
        name
        priceMinorUnits
      }
    }
  `;

  const ACTIVE_PRICING_QUERY = `
    query ActivePricing($serviceId: ID!) {
      activePricing(serviceId: $serviceId) {
        id
        serviceId
        priceMinorUnits
      }
    }
  `;

  // See `admin-foundation.e2e-spec.ts`'s identical helper for why this
  // "capture the Set-Cookie header, forward it explicitly" approach is used
  // instead of supertest's `request.agent()` jar — that jar silently drops
  // cookies over the plain-HTTP transport supertest drives, because
  // `AdminResolver.setSessionCookie` always sets `secure: true`.
  function extractSessionCookie(response: request.Response): string {
    const setCookieHeader = response.headers['set-cookie'] as unknown as
      string[] | undefined;
    if (!setCookieHeader || setCookieHeader.length === 0) {
      throw new Error('Expected a Set-Cookie header on the login response');
    }
    return setCookieHeader[0].split(';')[0];
  }

  async function login(email: string, password: string) {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: LOGIN_MUTATION,
        variables: { input: { email, password } },
      });
  }

  function authedRequest(sessionCookie: string) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', sessionCookie);
  }

  async function createAdmin(
    ownerSessionCookie: string,
    email: string,
    password: string,
    role: Role,
  ) {
    const response = await authedRequest(ownerSessionCookie).send({
      query: CREATE_ADMIN_MUTATION,
      variables: { input: { email, password, role } },
    });
    expect(response.body.errors).toBeUndefined();
    return response.body.data.createAdmin;
  }

  it('proves the full Catalog E2E acceptance scenario', async () => {
    const owner = await seedOwner(adminUserRepository);
    const runId = owner.id;

    const ownerLoginResponse = await login(owner.email, owner.password);
    expect(ownerLoginResponse.body.errors).toBeUndefined();
    expect(ownerLoginResponse.body.data.login).toEqual({
      success: true,
      admin: { id: owner.id, role: Role.OWNER },
    });
    const ownerSessionCookie = extractSessionCookie(ownerLoginResponse);

    // --- Step 1: Owner logs in -> createService succeeds -> createAddOn
    // succeeds -> createPricingRule succeeds for the service ->
    // `services { activePricing { priceMinorUnits } }` returns the service
    // with the correct active price -> `addOns` includes the created add-on
    // -> service.create/add_on.create/pricing_rule.create audit events
    // recorded. ---
    const serviceName = `Deep Clean ${runId}`;
    const createServiceResponse = await authedRequest(ownerSessionCookie).send({
      query: CREATE_SERVICE_MUTATION,
      variables: {
        input: {
          name: serviceName,
          description: 'A deep clean',
          durationMinutes: 90,
        },
      },
    });
    expect(createServiceResponse.body.errors).toBeUndefined();
    const createdService = createServiceResponse.body.data.createService;
    expect(createdService).toMatchObject({
      name: serviceName,
      description: 'A deep clean',
      durationMinutes: 90,
      active: true,
    });
    const serviceId: string = createdService.id;

    const serviceCreateAuditEvent = await auditEventRepository.findOneBy({
      action: 'service.create',
      entityId: serviceId,
    });
    expect(serviceCreateAuditEvent).not.toBeNull();
    expect(serviceCreateAuditEvent?.actorId).toBe(owner.id);

    const addOnName = `Fridge Interior ${runId}`;
    const createAddOnResponse = await authedRequest(ownerSessionCookie).send({
      query: CREATE_ADD_ON_MUTATION,
      variables: {
        input: {
          name: addOnName,
          description: 'Clean inside the fridge',
          priceMinorUnits: 1500,
        },
      },
    });
    expect(createAddOnResponse.body.errors).toBeUndefined();
    const createdAddOn = createAddOnResponse.body.data.createAddOn;
    expect(createdAddOn).toMatchObject({
      name: addOnName,
      description: 'Clean inside the fridge',
      priceMinorUnits: 1500,
      active: true,
    });
    const addOnId: string = createdAddOn.id;

    const addOnCreateAuditEvent = await auditEventRepository.findOneBy({
      action: 'add_on.create',
      entityId: addOnId,
    });
    expect(addOnCreateAuditEvent).not.toBeNull();
    expect(addOnCreateAuditEvent?.actorId).toBe(owner.id);

    const createPricingRuleResponse = await authedRequest(
      ownerSessionCookie,
    ).send({
      query: CREATE_PRICING_RULE_MUTATION,
      variables: { input: { serviceId, priceMinorUnits: 8000 } },
    });
    expect(createPricingRuleResponse.body.errors).toBeUndefined();
    const createdPricingRule =
      createPricingRuleResponse.body.data.createPricingRule;
    expect(createdPricingRule).toMatchObject({
      serviceId,
      priceMinorUnits: 8000,
    });
    const firstPricingRuleId: string = createdPricingRule.id;

    const pricingRuleCreateAuditEvent = await auditEventRepository.findOneBy({
      action: 'pricing_rule.create',
      entityId: firstPricingRuleId,
    });
    expect(pricingRuleCreateAuditEvent).not.toBeNull();
    expect(pricingRuleCreateAuditEvent?.actorId).toBe(owner.id);

    const servicesAfterPricingResponse = await authedRequest(
      ownerSessionCookie,
    ).send({ query: SERVICES_QUERY });
    expect(servicesAfterPricingResponse.body.errors).toBeUndefined();
    const servicesAfterPricing: Array<{
      id: string;
      activePricing: { priceMinorUnits: number } | null;
    }> = servicesAfterPricingResponse.body.data.services;
    const serviceRowAfterPricing = servicesAfterPricing.find(
      (s) => s.id === serviceId,
    );
    expect(serviceRowAfterPricing?.activePricing).toEqual({
      priceMinorUnits: 8000,
    });

    const addOnsAfterCreateResponse = await authedRequest(
      ownerSessionCookie,
    ).send({ query: ADD_ONS_QUERY });
    expect(addOnsAfterCreateResponse.body.errors).toBeUndefined();
    const addOnIdsAfterCreate: string[] =
      addOnsAfterCreateResponse.body.data.addOns.map(
        (a: { id: string }) => a.id,
      );
    expect(addOnIdsAfterCreate).toContain(addOnId);

    // --- Step 2: createPricingRule again for the SAME service (a
    // repricing) -> activePricing(serviceId) now returns the NEW price, not
    // the old one -> a second pricing_rule.create audit event exists ->
    // direct DB read confirms exactly one pricing_rule_entity row has
    // active: true for that service (end-to-end proof of the
    // deactivate-then-insert sequence). ---
    const repriceResponse = await authedRequest(ownerSessionCookie).send({
      query: CREATE_PRICING_RULE_MUTATION,
      variables: { input: { serviceId, priceMinorUnits: 9500 } },
    });
    expect(repriceResponse.body.errors).toBeUndefined();
    const repricedRule = repriceResponse.body.data.createPricingRule;
    expect(repricedRule).toMatchObject({ serviceId, priceMinorUnits: 9500 });
    const secondPricingRuleId: string = repricedRule.id;
    expect(secondPricingRuleId).not.toBe(firstPricingRuleId);

    const activePricingAfterRepriceResponse = await authedRequest(
      ownerSessionCookie,
    ).send({
      query: ACTIVE_PRICING_QUERY,
      variables: { serviceId },
    });
    expect(activePricingAfterRepriceResponse.body.errors).toBeUndefined();
    expect(
      activePricingAfterRepriceResponse.body.data.activePricing,
    ).toMatchObject({
      id: secondPricingRuleId,
      priceMinorUnits: 9500,
    });

    const secondPricingRuleCreateAuditEvent =
      await auditEventRepository.findOneBy({
        action: 'pricing_rule.create',
        entityId: secondPricingRuleId,
      });
    expect(secondPricingRuleCreateAuditEvent).not.toBeNull();
    expect(secondPricingRuleCreateAuditEvent?.actorId).toBe(owner.id);

    const activeRowsForService = await pricingRuleRepository.findBy({
      serviceId,
      active: true,
    });
    expect(activeRowsForService).toHaveLength(1);
    expect(activeRowsForService[0].id).toBe(secondPricingRuleId);

    // --- Step 3: updateService with only `durationMinutes` set -> re-fetch
    // confirms name/description unchanged, durationMinutes updated ->
    // service.update recorded. Then updateService with `active: false` ->
    // services query still returns it (unfiltered reads). ---
    const updateServiceResponse = await authedRequest(ownerSessionCookie).send({
      query: UPDATE_SERVICE_MUTATION,
      variables: { id: serviceId, input: { durationMinutes: 120 } },
    });
    expect(updateServiceResponse.body.errors).toBeUndefined();
    expect(updateServiceResponse.body.data.updateService).toMatchObject({
      id: serviceId,
      name: serviceName,
      description: 'A deep clean',
      durationMinutes: 120,
      active: true,
    });

    const serviceUpdateAuditEvent = await auditEventRepository.findOneBy({
      action: 'service.update',
      entityId: serviceId,
    });
    expect(serviceUpdateAuditEvent).not.toBeNull();
    expect(serviceUpdateAuditEvent?.actorId).toBe(owner.id);

    const deactivateServiceResponse = await authedRequest(
      ownerSessionCookie,
    ).send({
      query: UPDATE_SERVICE_MUTATION,
      variables: { id: serviceId, input: { active: false } },
    });
    expect(deactivateServiceResponse.body.errors).toBeUndefined();
    expect(deactivateServiceResponse.body.data.updateService).toMatchObject({
      id: serviceId,
      active: false,
    });

    const servicesAfterDeactivateResponse = await authedRequest(
      ownerSessionCookie,
    ).send({ query: SERVICES_QUERY });
    expect(servicesAfterDeactivateResponse.body.errors).toBeUndefined();
    const servicesAfterDeactivateIds: string[] =
      servicesAfterDeactivateResponse.body.data.services.map(
        (s: { id: string }) => s.id,
      );
    expect(servicesAfterDeactivateIds).toContain(serviceId);
    const deactivatedServiceRow =
      servicesAfterDeactivateResponse.body.data.services.find(
        (s: { id: string }) => s.id === serviceId,
      );
    expect(deactivatedServiceRow.active).toBe(false);

    // --- Step 4: updateAddOn with only `priceMinorUnits` set -> re-fetch
    // confirms name/description unchanged -> add_on.update recorded. ---
    const updateAddOnResponse = await authedRequest(ownerSessionCookie).send({
      query: UPDATE_ADD_ON_MUTATION,
      variables: { id: addOnId, input: { priceMinorUnits: 1800 } },
    });
    expect(updateAddOnResponse.body.errors).toBeUndefined();
    expect(updateAddOnResponse.body.data.updateAddOn).toMatchObject({
      id: addOnId,
      name: addOnName,
      description: 'Clean inside the fridge',
      priceMinorUnits: 1800,
      active: true,
    });

    const addOnUpdateAuditEvent = await auditEventRepository.findOneBy({
      action: 'add_on.update',
      entityId: addOnId,
    });
    expect(addOnUpdateAuditEvent).not.toBeNull();
    expect(addOnUpdateAuditEvent?.actorId).toBe(owner.id);

    const addOnsAfterUpdateResponse = await authedRequest(
      ownerSessionCookie,
    ).send({ query: ADD_ONS_QUERY });
    expect(addOnsAfterUpdateResponse.body.errors).toBeUndefined();
    const addOnRowAfterUpdate = addOnsAfterUpdateResponse.body.data.addOns.find(
      (a: { id: string }) => a.id === addOnId,
    );
    expect(addOnRowAfterUpdate).toMatchObject({
      id: addOnId,
      name: addOnName,
      priceMinorUnits: 1800,
    });

    // --- Step 5: Fixture — 3 services, 2 with an active PricingRule, 1
    // without. `services { activePricing { priceMinorUnits } }` asserts the
    // correct price/null per row (functional correctness, distinct from
    // step 6's query-count check). ---
    async function createServiceFixture(label: string) {
      const response = await authedRequest(ownerSessionCookie).send({
        query: CREATE_SERVICE_MUTATION,
        variables: {
          input: {
            name: `${label} ${runId}`,
            description: null,
            durationMinutes: 45,
          },
        },
      });
      expect(response.body.errors).toBeUndefined();
      return response.body.data.createService.id as string;
    }

    async function createPricingRuleFixture(
      fixtureServiceId: string,
      priceMinorUnits: number,
    ) {
      const response = await authedRequest(ownerSessionCookie).send({
        query: CREATE_PRICING_RULE_MUTATION,
        variables: { input: { serviceId: fixtureServiceId, priceMinorUnits } },
      });
      expect(response.body.errors).toBeUndefined();
    }

    const pricedServiceAId = await createServiceFixture('Priced Service A');
    const pricedServiceBId = await createServiceFixture('Priced Service B');
    const unpricedServiceId = await createServiceFixture('Unpriced Service');

    await createPricingRuleFixture(pricedServiceAId, 5000);
    await createPricingRuleFixture(pricedServiceBId, 6000);

    const servicesFixtureResponse = await authedRequest(
      ownerSessionCookie,
    ).send({ query: SERVICES_QUERY });
    expect(servicesFixtureResponse.body.errors).toBeUndefined();
    const servicesFixtureRows: Array<{
      id: string;
      activePricing: { priceMinorUnits: number } | null;
    }> = servicesFixtureResponse.body.data.services;
    const servicesFixtureById = new Map(
      servicesFixtureRows.map((row) => [row.id, row]),
    );
    expect(servicesFixtureById.get(pricedServiceAId)?.activePricing).toEqual({
      priceMinorUnits: 5000,
    });
    expect(servicesFixtureById.get(pricedServiceBId)?.activePricing).toEqual({
      priceMinorUnits: 6000,
    });
    expect(
      servicesFixtureById.get(unpricedServiceId)?.activePricing,
    ).toBeNull();

    // --- Step 6: Batching/query-count proof, distinct from step 5. Spy
    // wraps the REAL implementation (no `.mockImplementation`) so the actual
    // batched DB call happens; only the call count/arguments are inspected.
    // Re-issues the SAME `services { activePricing { priceMinorUnits } }`
    // request. Asserts BOTH the call count AND exact-set equality of the
    // argument set (not `arrayContaining`) — the unpriced service's id must
    // still appear, since a null-result key must still appear in the batch
    // call's argument set. This is the test that actually fails if the
    // resolver regresses to one `getActivePricing` call per parent row —
    // step 5 alone would still pass in that regression, since both a
    // batched and an N+1 implementation return identical data. ---
    const getActivePricingForServiceIdsSpy = jest.spyOn(
      pricingRulesService,
      'getActivePricingForServiceIds',
    );

    const servicesBatchResponse = await authedRequest(ownerSessionCookie).send({
      query: SERVICES_QUERY,
    });
    expect(servicesBatchResponse.body.errors).toBeUndefined();
    const expectedServiceIds: string[] = (
      servicesBatchResponse.body.data.services as Array<{ id: string }>
    ).map((row) => row.id);
    // Sanity check: the complete set of N service ids includes the unpriced
    // fixture service — otherwise the exact-set assertion below would be
    // vacuous.
    expect(expectedServiceIds).toContain(unpricedServiceId);

    expect(getActivePricingForServiceIdsSpy).toHaveBeenCalledTimes(1);
    expect(new Set(getActivePricingForServiceIdsSpy.mock.calls[0][0])).toEqual(
      new Set(expectedServiceIds),
    );

    getActivePricingForServiceIdsSpy.mockRestore();

    // --- Step 7: Owner creates a Scheduler, Customer Support, Finance, and
    // Analyst admin within this suite — no dependency on any other e2e
    // file's fixtures or execution order. ---
    const schedulerEmail = `scheduler-${runId}@example.com`;
    const schedulerPassword = 'scheduler-pw-12345';
    const scheduler = await createAdmin(
      ownerSessionCookie,
      schedulerEmail,
      schedulerPassword,
      Role.SCHEDULER,
    );
    expect(scheduler).toMatchObject({
      email: schedulerEmail,
      role: Role.SCHEDULER,
      isActive: true,
    });

    const customerSupportEmail = `customer-support-${runId}@example.com`;
    const customerSupportPassword = 'customer-support-pw-12345';
    const customerSupport = await createAdmin(
      ownerSessionCookie,
      customerSupportEmail,
      customerSupportPassword,
      Role.CUSTOMER_SUPPORT,
    );
    expect(customerSupport).toMatchObject({
      email: customerSupportEmail,
      role: Role.CUSTOMER_SUPPORT,
      isActive: true,
    });

    const financeEmail = `finance-${runId}@example.com`;
    const financePassword = 'finance-pw-12345';
    const finance = await createAdmin(
      ownerSessionCookie,
      financeEmail,
      financePassword,
      Role.FINANCE,
    );
    expect(finance).toMatchObject({
      email: financeEmail,
      role: Role.FINANCE,
      isActive: true,
    });

    const analystEmail = `analyst-${runId}@example.com`;
    const analystPassword = 'analyst-pw-12345';
    const analyst = await createAdmin(
      ownerSessionCookie,
      analystEmail,
      analystPassword,
      Role.ANALYST,
    );
    expect(analyst).toMatchObject({
      email: analystEmail,
      role: Role.ANALYST,
      isActive: true,
    });

    // --- Step 8: Log in as each of Scheduler, Customer Support, Finance,
    // and Analyst -> services/addOns/activePricing ALL succeed (view-allowed
    // for all six roles — this module's read matrix is broader than
    // Cleaners') -> createService/createAddOn/createPricingRule are ALL
    // denied for each of these four roles (write-restricted to Owner/Ops
    // Manager only). ---
    const nonWriterRoles: Array<{
      email: string;
      password: string;
      role: Role;
    }> = [
      {
        email: schedulerEmail,
        password: schedulerPassword,
        role: Role.SCHEDULER,
      },
      {
        email: customerSupportEmail,
        password: customerSupportPassword,
        role: Role.CUSTOMER_SUPPORT,
      },
      { email: financeEmail, password: financePassword, role: Role.FINANCE },
      { email: analystEmail, password: analystPassword, role: Role.ANALYST },
    ];

    for (const { email, password, role } of nonWriterRoles) {
      const loginResponse = await login(email, password);
      expect(loginResponse.body.errors).toBeUndefined();
      expect(loginResponse.body.data.login.success).toBe(true);
      const sessionCookie = extractSessionCookie(loginResponse);

      const servicesResponse = await authedRequest(sessionCookie).send({
        query: SERVICES_QUERY,
      });
      expect(servicesResponse.body.errors).toBeUndefined();
      const roleServiceIds: string[] = servicesResponse.body.data.services.map(
        (s: { id: string }) => s.id,
      );
      expect(roleServiceIds).toContain(serviceId);

      const addOnsResponse = await authedRequest(sessionCookie).send({
        query: ADD_ONS_QUERY,
      });
      expect(addOnsResponse.body.errors).toBeUndefined();
      const roleAddOnIds: string[] = addOnsResponse.body.data.addOns.map(
        (a: { id: string }) => a.id,
      );
      expect(roleAddOnIds).toContain(addOnId);

      const activePricingResponse = await authedRequest(sessionCookie).send({
        query: ACTIVE_PRICING_QUERY,
        variables: { serviceId },
      });
      expect(activePricingResponse.body.errors).toBeUndefined();
      expect(activePricingResponse.body.data.activePricing).toMatchObject({
        serviceId,
        priceMinorUnits: 9500,
      });

      const createServiceDeniedResponse = await authedRequest(
        sessionCookie,
      ).send({
        query: CREATE_SERVICE_MUTATION,
        variables: {
          input: {
            name: `Should Not Be Created ${role} ${runId}`,
            durationMinutes: 30,
          },
        },
      });
      expect(
        createServiceDeniedResponse.body.data?.createService,
      ).toBeUndefined();
      expect(
        createServiceDeniedResponse.body.errors?.[0]?.extensions?.code,
      ).toBe('FORBIDDEN');

      const createAddOnDeniedResponse = await authedRequest(sessionCookie).send(
        {
          query: CREATE_ADD_ON_MUTATION,
          variables: {
            input: {
              name: `Should Not Be Created ${role} ${runId}`,
              priceMinorUnits: 500,
            },
          },
        },
      );
      expect(createAddOnDeniedResponse.body.data?.createAddOn).toBeUndefined();
      expect(createAddOnDeniedResponse.body.errors?.[0]?.extensions?.code).toBe(
        'FORBIDDEN',
      );

      const createPricingRuleDeniedResponse = await authedRequest(
        sessionCookie,
      ).send({
        query: CREATE_PRICING_RULE_MUTATION,
        variables: { input: { serviceId, priceMinorUnits: 100 } },
      });
      expect(
        createPricingRuleDeniedResponse.body.data?.createPricingRule,
      ).toBeUndefined();
      expect(
        createPricingRuleDeniedResponse.body.errors?.[0]?.extensions?.code,
      ).toBe('FORBIDDEN');
    }

    // --- Step 9: createPricingRule with a nonexistent serviceId (as Owner)
    // -> rejected with a not-found error, no row persisted. `@nestjs/apollo`
    // only remaps HTTP 401/403/400/422 to well-known Apollo codes — a 404
    // `NotFoundException` falls through to
    // `extensions.code: 'INTERNAL_SERVER_ERROR'` with the original HTTP
    // status preserved at `extensions.status` (matching
    // `cleaners-teams.e2e-spec.ts`'s identical not-found-error precedent). ---
    const nonexistentServiceId = '00000000-0000-0000-0000-000000000000';
    const pricingRuleCountBeforeMissingService =
      await pricingRuleRepository.count();
    const missingServicePricingResponse = await authedRequest(
      ownerSessionCookie,
    ).send({
      query: CREATE_PRICING_RULE_MUTATION,
      variables: {
        input: { serviceId: nonexistentServiceId, priceMinorUnits: 100 },
      },
    });
    expect(
      missingServicePricingResponse.body.data?.createPricingRule,
    ).toBeUndefined();
    const missingServicePricingError =
      missingServicePricingResponse.body.errors?.[0];
    expect(missingServicePricingError?.extensions?.status).toBe(404);
    expect(missingServicePricingError?.message).toContain(
      `Service ${nonexistentServiceId} not found`,
    );
    const pricingRuleCountAfterMissingService =
      await pricingRuleRepository.count();
    expect(pricingRuleCountAfterMissingService).toBe(
      pricingRuleCountBeforeMissingService,
    );

    // --- Step 10: createService with a name matching an already-existing
    // service, in a DIFFERENT CASE -> rejected with a conflict error, no
    // duplicate persisted. Same case-insensitive-conflict check repeated for
    // createAddOn. `ConflictException` is likewise outside `@nestjs/apollo`'s
    // remapped set, so it falls through the same way with
    // `extensions.status: 409`. ---
    const duplicateCaseServiceName = serviceName.toLowerCase();
    expect(duplicateCaseServiceName).not.toBe(serviceName);
    const duplicateServiceResponse = await authedRequest(
      ownerSessionCookie,
    ).send({
      query: CREATE_SERVICE_MUTATION,
      variables: {
        input: { name: duplicateCaseServiceName, durationMinutes: 30 },
      },
    });
    expect(duplicateServiceResponse.body.data?.createService).toBeUndefined();
    const duplicateServiceError = duplicateServiceResponse.body.errors?.[0];
    expect(duplicateServiceError?.extensions?.status).toBe(409);
    expect(duplicateServiceError?.message).toContain('already in use');

    const servicesAfterDuplicateResponse = await authedRequest(
      ownerSessionCookie,
    ).send({ query: SERVICES_QUERY });
    expect(servicesAfterDuplicateResponse.body.errors).toBeUndefined();
    const servicesMatchingNameCaseInsensitive = (
      servicesAfterDuplicateResponse.body.data.services as Array<{
        name: string;
      }>
    ).filter((s) => s.name.toLowerCase() === serviceName.toLowerCase());
    expect(servicesMatchingNameCaseInsensitive).toHaveLength(1);

    const duplicateCaseAddOnName = addOnName.toLowerCase();
    expect(duplicateCaseAddOnName).not.toBe(addOnName);
    const duplicateAddOnResponse = await authedRequest(ownerSessionCookie).send(
      {
        query: CREATE_ADD_ON_MUTATION,
        variables: {
          input: { name: duplicateCaseAddOnName, priceMinorUnits: 100 },
        },
      },
    );
    expect(duplicateAddOnResponse.body.data?.createAddOn).toBeUndefined();
    const duplicateAddOnError = duplicateAddOnResponse.body.errors?.[0];
    expect(duplicateAddOnError?.extensions?.status).toBe(409);
    expect(duplicateAddOnError?.message).toContain('already in use');

    const addOnsAfterDuplicateResponse = await authedRequest(
      ownerSessionCookie,
    ).send({ query: ADD_ONS_QUERY });
    expect(addOnsAfterDuplicateResponse.body.errors).toBeUndefined();
    const addOnsMatchingNameCaseInsensitive = (
      addOnsAfterDuplicateResponse.body.data.addOns as Array<{
        name: string;
      }>
    ).filter((a) => a.name.toLowerCase() === addOnName.toLowerCase());
    expect(addOnsMatchingNameCaseInsensitive).toHaveLength(1);

    // --- Step 11: activePricing(serviceId) for a service with no pricing
    // yet -> returns null (not an error). activePricing(serviceId) for a
    // nonexistent serviceId -> rejected with a not-found error. ---
    const noPricingResponse = await authedRequest(ownerSessionCookie).send({
      query: ACTIVE_PRICING_QUERY,
      variables: { serviceId: unpricedServiceId },
    });
    expect(noPricingResponse.body.errors).toBeUndefined();
    expect(noPricingResponse.body.data.activePricing).toBeNull();

    const missingServiceActivePricingResponse = await authedRequest(
      ownerSessionCookie,
    ).send({
      query: ACTIVE_PRICING_QUERY,
      variables: { serviceId: nonexistentServiceId },
    });
    // Unlike the mutation-denial checks above, `activePricing` is a
    // NULLABLE field (`{ name: 'activePricing', nullable: true }` on the
    // resolver) — GraphQL's null-propagation rule resolves a thrown error on
    // a nullable field to `data.activePricing: null` (not an undefined/null
    // `data` object), while still populating `errors`. A non-nullable
    // mutation field instead nulls out the entire `data` object, which is
    // why the mutation-denial assertions above check `body.data?.field` for
    // `undefined`.
    expect(
      missingServiceActivePricingResponse.body.data?.activePricing,
    ).toBeNull();
    const missingServiceActivePricingError =
      missingServiceActivePricingResponse.body.errors?.[0];
    expect(missingServiceActivePricingError?.extensions?.status).toBe(404);
    expect(missingServiceActivePricingError?.message).toContain(
      `Service ${nonexistentServiceId} not found`,
    );
  });
});
