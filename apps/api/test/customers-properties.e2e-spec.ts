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
import { PropertyEntity } from '../src/modules/customers/infrastructure/persistence/property.entity';
import { Role } from '../src/platform/auth/domain/role';
import { seedOwner } from './helpers/seed-owner';

// Proves plan task-6 brief's full 8-step Customers/Properties E2E acceptance
// scenario end-to-end: real HTTP (supertest) against the real `AppModule`
// (full composition root — GraphQL, auth guard/strategy, customers/properties
// services, audit logger) and a real Postgres connection. This is a
// black-box proof of the resolver -> guard -> service -> database wiring; it
// deliberately does NOT re-prove what Task 1/2's real-Postgres service-level
// tests (`customers-properties.service.e2e-spec.ts`) already cover
// (explicit-`null`-vs-omitted persistence, audit-failure rollback) — that
// would be redundant coverage of the same guarantee through a slower path.
//
// Self-contained, following `admin-foundation.e2e-spec.ts`'s exact
// precedent: seeds its own Owner via `helpers/seed-owner.ts`, uses
// unique-per-run data (random ids/emails), and scopes every assertion to
// specific returned ids rather than exact counts/global truncation — which
// is what makes it safe to run against the same, non-truncated, real
// Postgres database as every other suite without needing the advisory-lock
// helper `customers-properties.service.e2e-spec.ts` uses.
//
// No GraphQL query exposes audit events (spec §3, matching Admin
// Foundation) — every audit assertion below reads `AuditEventEntity`
// directly via a repository pulled off the same `TestingModule`, never
// through a query this suite invents.
describe('Customers & Properties (e2e)', () => {
  let app: INestApplication<App>;
  let adminUserRepository: Repository<AdminUserEntity>;
  let auditEventRepository: Repository<AuditEventEntity>;
  let propertyRepository: Repository<PropertyEntity>;

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
    propertyRepository = moduleFixture.get(getRepositoryToken(PropertyEntity));
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

  const CREATE_CUSTOMER_MUTATION = `
    mutation CreateCustomer($input: CreateCustomerInput!) {
      createCustomer(input: $input) {
        id
        fullName
        email
        phone
        notes
      }
    }
  `;

  const UPDATE_CUSTOMER_MUTATION = `
    mutation UpdateCustomer($id: ID!, $input: UpdateCustomerInput!) {
      updateCustomer(id: $id, input: $input) {
        id
        fullName
        email
        phone
        notes
      }
    }
  `;

  const CREATE_PROPERTY_MUTATION = `
    mutation CreateProperty($customerId: ID!, $input: CreatePropertyInput!) {
      createProperty(customerId: $customerId, input: $input) {
        id
        customerId
        label
        addressLine1
        addressLine2
        city
        region
        postalCode
        accessNotes
      }
    }
  `;

  const UPDATE_PROPERTY_MUTATION = `
    mutation UpdateProperty($id: ID!, $input: UpdatePropertyInput!) {
      updateProperty(id: $id, input: $input) {
        id
        label
      }
    }
  `;

  const CUSTOMER_QUERY = `
    query Customer($id: ID!) {
      customer(id: $id) {
        id
        fullName
        email
        phone
        notes
        properties {
          id
          label
        }
      }
    }
  `;

  const CUSTOMERS_QUERY = `
    query {
      customers {
        id
      }
    }
  `;

  const PROPERTY_QUERY = `
    query Property($id: ID!) {
      property(id: $id) {
        id
        customerId
        label
        addressLine1
        addressLine2
        city
        region
        postalCode
        accessNotes
      }
    }
  `;

  const CUSTOMER_PROPERTIES_QUERY = `
    query CustomerProperties($customerId: ID!) {
      customerProperties(customerId: $customerId) {
        id
        label
        addressLine1
        addressLine2
        city
        region
        postalCode
        accessNotes
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

  it('proves the full Customers & Properties E2E acceptance scenario', async () => {
    const owner = await seedOwner(adminUserRepository);
    const runId = owner.id;

    // --- Step 1: Owner logs in, createCustomer + createProperty succeed,
    // customer(id)/customers surface both, both audit events recorded. ---
    const ownerLoginResponse = await login(owner.email, owner.password);
    expect(ownerLoginResponse.body.errors).toBeUndefined();
    expect(ownerLoginResponse.body.data.login).toEqual({
      success: true,
      admin: { id: owner.id, role: Role.OWNER },
    });
    const ownerSessionCookie = extractSessionCookie(ownerLoginResponse);

    const customerEmail = `customer-${runId}@example.com`;
    const createCustomerResponse = await authedRequest(ownerSessionCookie).send(
      {
        query: CREATE_CUSTOMER_MUTATION,
        variables: {
          input: {
            fullName: 'Jane E2E',
            email: customerEmail,
            phone: '555-0100',
            notes: 'Initial notes',
          },
        },
      },
    );
    expect(createCustomerResponse.body.errors).toBeUndefined();
    const createdCustomer = createCustomerResponse.body.data.createCustomer;
    expect(createdCustomer).toMatchObject({
      fullName: 'Jane E2E',
      email: customerEmail,
      phone: '555-0100',
      notes: 'Initial notes',
    });
    const customerId: string = createdCustomer.id;

    const customerCreateAuditEvent = await auditEventRepository.findOneBy({
      action: 'customer.create',
      entityId: customerId,
    });
    expect(customerCreateAuditEvent).not.toBeNull();
    expect(customerCreateAuditEvent?.actorId).toBe(owner.id);

    const createPropertyResponse = await authedRequest(ownerSessionCookie).send(
      {
        query: CREATE_PROPERTY_MUTATION,
        variables: {
          customerId,
          input: {
            label: 'Home',
            addressLine1: '123 Main St',
            addressLine2: 'Unit 4',
            city: 'Springfield',
            region: 'IL',
            postalCode: '62704',
            accessNotes: 'Gate code 1234',
          },
        },
      },
    );
    expect(createPropertyResponse.body.errors).toBeUndefined();
    const createdProperty = createPropertyResponse.body.data.createProperty;
    expect(createdProperty).toMatchObject({
      customerId,
      label: 'Home',
      addressLine1: '123 Main St',
      addressLine2: 'Unit 4',
      city: 'Springfield',
      region: 'IL',
      postalCode: '62704',
      accessNotes: 'Gate code 1234',
    });
    const propertyId: string = createdProperty.id;

    const propertyCreateAuditEvent = await auditEventRepository.findOneBy({
      action: 'property.create',
      entityId: propertyId,
    });
    expect(propertyCreateAuditEvent).not.toBeNull();
    expect(propertyCreateAuditEvent?.actorId).toBe(owner.id);

    const propertyByIdResponse = await authedRequest(ownerSessionCookie).send({
      query: PROPERTY_QUERY,
      variables: { id: propertyId },
    });
    expect(propertyByIdResponse.body.errors).toBeUndefined();
    expect(propertyByIdResponse.body.data.property).toMatchObject({
      id: propertyId,
      customerId,
      label: 'Home',
      addressLine1: '123 Main St',
      addressLine2: 'Unit 4',
      city: 'Springfield',
      region: 'IL',
      postalCode: '62704',
      accessNotes: 'Gate code 1234',
    });

    const customerAfterCreateResponse = await authedRequest(
      ownerSessionCookie,
    ).send({
      query: CUSTOMER_QUERY,
      variables: { id: customerId },
    });
    expect(customerAfterCreateResponse.body.errors).toBeUndefined();
    const fetchedCustomer = customerAfterCreateResponse.body.data.customer;
    expect(fetchedCustomer.id).toBe(customerId);
    expect(fetchedCustomer.properties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: propertyId, label: 'Home' }),
      ]),
    );

    const customersListResponse = await authedRequest(ownerSessionCookie).send({
      query: CUSTOMERS_QUERY,
    });
    expect(customersListResponse.body.errors).toBeUndefined();
    const customerIds: string[] = customersListResponse.body.data.customers.map(
      (c: { id: string }) => c.id,
    );
    expect(customerIds).toContain(customerId);

    // --- Step 2: updateCustomer with only `phone` set; re-fetch confirms
    // fullName/email unchanged, phone updated; customer.update recorded. ---
    const updateCustomerResponse = await authedRequest(ownerSessionCookie).send(
      {
        query: UPDATE_CUSTOMER_MUTATION,
        variables: {
          id: customerId,
          input: { phone: '555-9999' },
        },
      },
    );
    expect(updateCustomerResponse.body.errors).toBeUndefined();
    expect(updateCustomerResponse.body.data.updateCustomer).toMatchObject({
      id: customerId,
      fullName: 'Jane E2E',
      email: customerEmail,
      phone: '555-9999',
      notes: 'Initial notes',
    });

    const customerUpdateAuditEvent = await auditEventRepository.findOneBy({
      action: 'customer.update',
      entityId: customerId,
    });
    expect(customerUpdateAuditEvent).not.toBeNull();
    expect(customerUpdateAuditEvent?.actorId).toBe(owner.id);

    const customerAfterUpdateResponse = await authedRequest(
      ownerSessionCookie,
    ).send({
      query: CUSTOMER_QUERY,
      variables: { id: customerId },
    });
    expect(customerAfterUpdateResponse.body.errors).toBeUndefined();
    expect(customerAfterUpdateResponse.body.data.customer).toMatchObject({
      id: customerId,
      fullName: 'Jane E2E',
      email: customerEmail,
      phone: '555-9999',
      notes: 'Initial notes',
    });

    // --- Step 3: updateProperty on the step-1 property, only `label` set;
    // re-fetch via customerProperties confirms the address fields are
    // unchanged and label updated; property.update recorded. Proves
    // `PropertyResolver`'s guard/command-spread wiring specifically. ---
    const updatePropertyResponse = await authedRequest(ownerSessionCookie).send(
      {
        query: UPDATE_PROPERTY_MUTATION,
        variables: {
          id: propertyId,
          input: { label: 'Updated Label' },
        },
      },
    );
    expect(updatePropertyResponse.body.errors).toBeUndefined();
    expect(updatePropertyResponse.body.data.updateProperty).toEqual({
      id: propertyId,
      label: 'Updated Label',
    });

    const propertyUpdateAuditEvent = await auditEventRepository.findOneBy({
      action: 'property.update',
      entityId: propertyId,
    });
    expect(propertyUpdateAuditEvent).not.toBeNull();
    expect(propertyUpdateAuditEvent?.actorId).toBe(owner.id);

    const customerPropertiesResponse = await authedRequest(
      ownerSessionCookie,
    ).send({
      query: CUSTOMER_PROPERTIES_QUERY,
      variables: { customerId },
    });
    expect(customerPropertiesResponse.body.errors).toBeUndefined();
    const properties: Array<Record<string, unknown>> =
      customerPropertiesResponse.body.data.customerProperties;
    const refetchedProperty = properties.find((p) => p.id === propertyId);
    expect(refetchedProperty).toMatchObject({
      id: propertyId,
      label: 'Updated Label',
      // Address fields untouched by the label-only update.
      addressLine1: '123 Main St',
      addressLine2: 'Unit 4',
      city: 'Springfield',
      region: 'IL',
      postalCode: '62704',
      accessNotes: 'Gate code 1234',
    });

    // --- Step 4: Owner creates a Scheduler, Customer Support, Analyst, and
    // Finance admin for the RBAC checks below. ---
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

    // --- Step 5: Scheduler logs in; customers query succeeds (view-allowed);
    // createCustomer denied (write-restricted). ---
    const schedulerLoginResponse = await login(
      schedulerEmail,
      schedulerPassword,
    );
    expect(schedulerLoginResponse.body.errors).toBeUndefined();
    expect(schedulerLoginResponse.body.data.login.success).toBe(true);
    const schedulerSessionCookie = extractSessionCookie(schedulerLoginResponse);

    const schedulerCustomersResponse = await authedRequest(
      schedulerSessionCookie,
    ).send({ query: CUSTOMERS_QUERY });
    expect(schedulerCustomersResponse.body.errors).toBeUndefined();
    const schedulerCustomerIds: string[] =
      schedulerCustomersResponse.body.data.customers.map(
        (c: { id: string }) => c.id,
      );
    expect(schedulerCustomerIds).toContain(customerId);

    const schedulerCreateCustomerResponse = await authedRequest(
      schedulerSessionCookie,
    ).send({
      query: CREATE_CUSTOMER_MUTATION,
      variables: {
        input: {
          fullName: 'Should Not Be Created',
          email: `should-not-be-created-scheduler-${runId}@example.com`,
          phone: '555-0000',
        },
      },
    });
    expect(
      schedulerCreateCustomerResponse.body.data?.createCustomer,
    ).toBeUndefined();
    expect(
      schedulerCreateCustomerResponse.body.errors?.[0]?.extensions?.code,
    ).toBe('FORBIDDEN');

    // --- Step 6: Analyst logs in; customers query succeeds (view-allowed) —
    // the one view-matrix role besides Scheduler not otherwise exercised by
    // this suite or the Admin Foundation one. ---
    const analystLoginResponse = await login(analystEmail, analystPassword);
    expect(analystLoginResponse.body.errors).toBeUndefined();
    expect(analystLoginResponse.body.data.login.success).toBe(true);
    const analystSessionCookie = extractSessionCookie(analystLoginResponse);

    const analystCustomersResponse = await authedRequest(
      analystSessionCookie,
    ).send({ query: CUSTOMERS_QUERY });
    expect(analystCustomersResponse.body.errors).toBeUndefined();
    const analystCustomerIds: string[] =
      analystCustomersResponse.body.data.customers.map(
        (c: { id: string }) => c.id,
      );
    expect(analystCustomerIds).toContain(customerId);

    // --- Step 7: Finance admin logs in; customers query denied (no view
    // access per the RBAC matrix); createCustomer denied. ---
    const financeLoginResponse = await login(financeEmail, financePassword);
    expect(financeLoginResponse.body.errors).toBeUndefined();
    expect(financeLoginResponse.body.data.login.success).toBe(true);
    const financeSessionCookie = extractSessionCookie(financeLoginResponse);

    const financeCustomersResponse = await authedRequest(
      financeSessionCookie,
    ).send({ query: CUSTOMERS_QUERY });
    expect(financeCustomersResponse.body.data?.customers).toBeUndefined();
    expect(financeCustomersResponse.body.errors?.[0]?.extensions?.code).toBe(
      'FORBIDDEN',
    );

    const financeCreateCustomerResponse = await authedRequest(
      financeSessionCookie,
    ).send({
      query: CREATE_CUSTOMER_MUTATION,
      variables: {
        input: {
          fullName: 'Should Not Be Created',
          email: `should-not-be-created-finance-${runId}@example.com`,
          phone: '555-0000',
        },
      },
    });
    expect(
      financeCreateCustomerResponse.body.data?.createCustomer,
    ).toBeUndefined();
    expect(
      financeCreateCustomerResponse.body.errors?.[0]?.extensions?.code,
    ).toBe('FORBIDDEN');

    // --- Step 7b: Customer Support logs in; createCustomer succeeds — the
    // write-allow side of the matrix for a non-Owner write-permitted role,
    // proven end-to-end (previously only covered by Task 3's decorator-
    // metadata reflection tests). ---
    const customerSupportLoginResponse = await login(
      customerSupportEmail,
      customerSupportPassword,
    );
    expect(customerSupportLoginResponse.body.errors).toBeUndefined();
    expect(customerSupportLoginResponse.body.data.login.success).toBe(true);
    const customerSupportSessionCookie = extractSessionCookie(
      customerSupportLoginResponse,
    );

    const customerSupportCreateCustomerResponse = await authedRequest(
      customerSupportSessionCookie,
    ).send({
      query: CREATE_CUSTOMER_MUTATION,
      variables: {
        input: {
          fullName: 'Created By Customer Support',
          email: `created-by-customer-support-${runId}@example.com`,
          phone: '555-0111',
        },
      },
    });
    expect(customerSupportCreateCustomerResponse.body.errors).toBeUndefined();
    expect(
      customerSupportCreateCustomerResponse.body.data.createCustomer,
    ).toMatchObject({
      fullName: 'Created By Customer Support',
      email: `created-by-customer-support-${runId}@example.com`,
      phone: '555-0111',
    });

    // --- Step 8: createProperty with a nonexistent customerId (as Owner) is
    // rejected with a not-found error, and no property is persisted. The
    // nonexistent id must still be a well-formed UUID — `customerId` is a
    // Postgres `uuid` column (`PropertyEntity`), so a non-UUID string would
    // fail differently (a DB type error), not exercise the service's
    // `NotFoundException` existence check this step targets. `@nestjs/apollo`
    // only remaps HTTP 401/403/400/422 to well-known Apollo codes (see
    // `apolloPredefinedExceptions` in `apollo-base.driver.js`) — a 404
    // `NotFoundException` falls through to `extensions.code:
    // 'INTERNAL_SERVER_ERROR'` with the original HTTP status preserved at
    // `extensions.status`, so that (not `NOT_FOUND`) is what a not-found
    // GraphQL error actually looks like in this codebase.
    const nonexistentCustomerId = '00000000-0000-0000-0000-000000000000';
    const uniquePropertyLabel = `should-not-persist-${runId}`;
    const missingParentResponse = await authedRequest(ownerSessionCookie).send({
      query: CREATE_PROPERTY_MUTATION,
      variables: {
        customerId: nonexistentCustomerId,
        input: {
          label: uniquePropertyLabel,
          addressLine1: '1 Nowhere Ave',
          city: 'Nowhere',
          region: 'NA',
          postalCode: '00000',
        },
      },
    });
    expect(missingParentResponse.body.data?.createProperty).toBeUndefined();
    const missingParentError = missingParentResponse.body.errors?.[0];
    expect(missingParentError?.extensions?.status).toBe(404);
    expect(missingParentError?.message).toContain(
      `Customer ${nonexistentCustomerId} not found`,
    );

    const persistedRow = await propertyRepository.findOneBy({
      label: uniquePropertyLabel,
    });
    expect(persistedRow).toBeNull();
  });
});
