import { INestApplication } from '@nestjs/common';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import {
  getNamedType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLSchema,
} from 'graphql';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, In, QueryFailedError, Repository } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { InvoiceEntity } from '../src/modules/billing/infrastructure/persistence/invoice.entity';
import { AddOnsService } from '../src/modules/catalog/application/services/add-ons.service';
import { PricingRulesService } from '../src/modules/catalog/application/services/pricing-rules.service';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { PricingUnit } from '../src/modules/catalog/domain/pricing-unit';
import { CustomerEntity } from '../src/modules/customers/infrastructure/persistence/customer.entity';
import { LaundryOrderEntity } from '../src/modules/laundry/infrastructure/persistence/laundry-order.entity';
import { LaundryOrderLineEntity } from '../src/modules/laundry/infrastructure/persistence/laundry-order-line.entity';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { Role } from '../src/platform/auth/domain/role';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import {
  createTestTenant,
  removeTestTenants,
  seedSuperAdmin,
  seedTenantAdmin,
} from './helpers/seed-tenant-admin';
import { uniqueEmail } from './helpers/unique-email';

// Two-tenant isolation for LaundryOrder, LaundryOrderLine and Invoice (#87)
// through the real GraphQL + application-service stack. Cases 0–3 are the
// #82 I1 acceptance proof: each pairs B's negative result with A's positive
// control, so no case passes merely because a query returns nothing for
// everyone. Also proves I-1 (application half via cross-tenant mutations,
// database half via the composite FKs), I-2 (the only tenant source is the
// principal), I-3 (per-tenant, concurrency-safe numbering) and the audit
// tags.
//
// Self-contained: two fresh test tenants, unique-per-run rows, assertions
// scoped to the ids this suite created. Cases run in order: no A or B invoice
// is generated between setup and case 9.
describe('Laundry & Billing tenant isolation (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let auditEventRepository: Repository<AuditEventEntity>;
  let orderRepository: Repository<LaundryOrderEntity>;
  let lineRepository: Repository<LaundryOrderLineEntity>;
  let invoiceRepository: Repository<InvoiceEntity>;

  const run = randomUUID();
  let tenantA: string;
  let tenantB: string;
  let cookieA: string;
  let cookieB: string;
  let cookieSuperAdmin: string;
  let ownerAId: string;
  let ownerBId: string;
  let customerA: CustomerEntity;
  let customerB: CustomerEntity;
  let serviceA: { id: string };
  let serviceB: { id: string };
  let addOnA: { id: string };
  let addOnB: { id: string };
  let orderA: string; // priced, invoiced (invoiceA)
  let orderB: string; // priced, invoiced (invoiceB)
  let openA: string; // RECEIVED
  let openB: string; // RECEIVED
  let pricedA2: string; // priced, never invoiced
  let weighedB: string; // WEIGHED, never priced or invoiced
  let invoiceA: { id: string; invoiceNumber: string };
  let invoiceB: { id: string; invoiceNumber: string };

  const LOGIN = `mutation($input: LoginInput!){ login(loginInput:$input){ success } }`;
  const RECEIVE = `mutation($i: ReceiveLaundryOrderInput!){ receiveLaundryOrder(input:$i){ id } }`;
  const WEIGH = `mutation($i: WeighLaundryOrderInput!){ weighLaundryOrder(input:$i){ id status } }`;
  const PRICE = `mutation($i: PriceLaundryOrderInput!){ priceLaundryOrder(input:$i){ id status } }`;
  const GENERATE = `mutation($i: GenerateInvoiceFromOrderInput!){ generateInvoiceFromOrder(input:$i){ id invoiceNumber } }`;
  const ORDERS = `query($f: LaundryOrderFilter){ laundryOrders(filter:$f, paging:{limit:50}){ totalCount nodes { id } } }`;
  const ORDERS_COUNT = `query($f: LaundryOrderFilter){ laundryOrders(filter:$f, paging:{limit:50}){ totalCount } }`;
  const INVOICES = `query($f: InvoiceFilter){ invoices(filter:$f, paging:{limit:50}){ totalCount nodes { id } } }`;
  const INVOICES_COUNT = `query($f: InvoiceFilter){ invoices(filter:$f, paging:{limit:50}){ totalCount } }`;

  // The 12 payload-free transition verbs (`LaundryOrderRefInput`).
  const TRANSITIONS = [
    'cancelLaundryOrder',
    'completeLaundryOrder',
    'markLaundryOrderAwaitingDelivery',
    'markLaundryOrderAwaitingPayment',
    'markLaundryOrderAwaitingPickup',
    'markLaundryOrderDamaged',
    'markLaundryOrderLost',
    'markLaundryOrderPaid',
    'markLaundryOrderReady',
    'refundLaundryOrder',
    'rejectLaundryOrder',
    'startLaundryProcessing',
  ];
  const LAUNDRY_MUTATIONS = [
    ...TRANSITIONS,
    'priceLaundryOrder',
    'receiveLaundryOrder',
    'weighLaundryOrder',
  ];

  function extractSessionCookie(response: request.Response): string {
    const setCookieHeader = response.headers['set-cookie'] as unknown as
      string[] | undefined;
    if (!setCookieHeader || setCookieHeader.length === 0) {
      throw new Error('Expected a Set-Cookie header on the login response');
    }
    return setCookieHeader[0].split(';')[0];
  }

  async function loginAs(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: LOGIN, variables: { input: { email, password } } });
    return extractSessionCookie(response);
  }

  function gql(
    cookie: string,
    query: string,
    variables: Record<string, unknown> = {},
    headers: Record<string, string> = {},
  ) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', cookie)
      .set(headers)
      .send({ query, variables });
  }

  // See `catalog.tenant-isolation.e2e-spec.ts`'s identical helper for the
  // full rationale on reading both extension shapes.
  function errorStatus(response: request.Response): number | undefined {
    const error = (
      response.body as {
        errors?: {
          extensions?: {
            status?: number;
            originalError?: { statusCode?: number };
          };
        }[];
      }
    ).errors?.[0];
    return (
      error?.extensions?.status ?? error?.extensions?.originalError?.statusCode
    );
  }

  async function ok(response: request.Response): Promise<request.Response> {
    expect(response.body.errors).toBeUndefined();
    return Promise.resolve(response);
  }

  async function insertCustomer(
    tenantId: string,
    prefix: string,
  ): Promise<CustomerEntity> {
    const repository = dataSource.getRepository(CustomerEntity);
    return repository.save(
      repository.create({
        tenantId,
        email: uniqueEmail(`laundry-isolation-${prefix.toLowerCase()}`),
        fullName: `${prefix} Laundry ${run}`,
        notes: null,
        phone: '555-0100',
      }),
    );
  }

  type Tenant = 'A' | 'B';
  const cookieOf = (t: Tenant) => (t === 'A' ? cookieA : cookieB);

  async function receiveAs(t: Tenant): Promise<string> {
    const res = await ok(
      await gql(cookieOf(t), RECEIVE, {
        i: {
          customerId: (t === 'A' ? customerA : customerB).id,
          fulfillmentType: 'PICKUP',
        },
      }),
    );
    return res.body.data.receiveLaundryOrder.id as string;
  }

  async function weighAs(t: Tenant, orderId: string): Promise<void> {
    await ok(
      await gql(cookieOf(t), WEIGH, { i: { orderId, weightGrams: 1500 } }),
    );
  }

  async function pricedOrderAs(t: Tenant): Promise<string> {
    const orderId = await receiveAs(t);
    await weighAs(t, orderId);
    await ok(
      await gql(cookieOf(t), PRICE, {
        i: {
          orderId,
          addOns: [{ addOnId: (t === 'A' ? addOnA : addOnB).id }],
          baseServiceId: (t === 'A' ? serviceA : serviceB).id,
        },
      }),
    );
    return orderId;
  }

  async function generateAs(
    t: Tenant,
    laundryOrderId: string,
  ): Promise<request.Response> {
    return gql(cookieOf(t), GENERATE, {
      i: { laundryOrderId, paymentTerms: 'PAY_NOW' },
    });
  }

  async function counterOf(tenantId: string): Promise<number> {
    const rows: { lastValue: string }[] = await dataSource.query(
      `SELECT "lastValue" FROM "invoice_number_counter" WHERE "tenantId" = $1`,
      [tenantId],
    );
    return rows.length === 0 ? 0 : Number(rows[0].lastValue);
  }

  const suffix = (invoiceNumber: string): number =>
    Number(invoiceNumber.split('-')[2]);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    applyPlatformPipes(app);
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    auditEventRepository = moduleFixture.get(
      getRepositoryToken(AuditEventEntity),
    );
    orderRepository = dataSource.getRepository(LaundryOrderEntity);
    lineRepository = dataSource.getRepository(LaundryOrderLineEntity);
    invoiceRepository = dataSource.getRepository(InvoiceEntity);
    const servicesService = moduleFixture.get(ServicesService);
    const addOnsService = moduleFixture.get(AddOnsService);
    const pricingRulesService = moduleFixture.get(PricingRulesService);

    tenantA = await createTestTenant(dataSource);
    tenantB = await createTestTenant(dataSource);
    const ownerA = await seedTenantAdmin(
      dataSource,
      Role.TENANT_OWNER,
      tenantA,
    );
    const ownerB = await seedTenantAdmin(
      dataSource,
      Role.TENANT_OWNER,
      tenantB,
    );
    const superAdmin = await seedSuperAdmin(dataSource);
    ownerAId = ownerA.id;
    ownerBId = ownerB.id;
    cookieA = await loginAs(ownerA.email, ownerA.password);
    cookieB = await loginAs(ownerB.email, ownerB.password);
    cookieSuperAdmin = await loginAs(superAdmin.email, superAdmin.password);

    for (const [t, tenantId, actorId] of [
      ['A', tenantA, ownerAId],
      ['B', tenantB, ownerBId],
    ] as const) {
      const service = await servicesService.createService({
        actorId,
        tenantId,
        durationMinutes: 60,
        name: `Laundry Wash ${t} ${run}`,
      });
      await pricingRulesService.createPricingRule({
        actorId,
        serviceId: service.id,
        tenantId,
        priceMinorUnits: 1000,
        unit: PricingUnit.PER_KG,
      });
      const addOn = await addOnsService.createAddOn({
        actorId,
        tenantId,
        name: `Laundry Fold ${t} ${run}`,
        priceMinorUnits: 300,
      });
      await pricingRulesService.createPricingRule({
        actorId,
        addOnId: addOn.id,
        tenantId,
        priceMinorUnits: 300,
        unit: PricingUnit.FLAT,
      });
      if (t === 'A') {
        serviceA = service;
        addOnA = addOn;
      } else {
        serviceB = service;
        addOnB = addOn;
      }
    }
    customerA = await insertCustomer(tenantA, 'Alpha');
    customerB = await insertCustomer(tenantB, 'Bravo');

    orderA = await pricedOrderAs('A');
    orderB = await pricedOrderAs('B');
    openA = await receiveAs('A');
    openB = await receiveAs('B');
    pricedA2 = await pricedOrderAs('A');
    weighedB = await receiveAs('B');
    await weighAs('B', weighedB);
    invoiceA = (await ok(await generateAs('A', orderA))).body.data
      .generateInvoiceFromOrder;
    invoiceB = (await ok(await generateAs('B', orderB))).body.data
      .generateInvoiceFromOrder;
  }, 60_000);

  afterAll(async () => {
    try {
      if (dataSource) {
        await auditEventRepository.delete({
          actorId: In([ownerAId, ownerBId]),
        });
        // Orders (and lines), invoices (and lines), counter rows, catalog
        // and customers of tenantA/tenantB are removed by
        // `removeTestTenants` (#87 Task 1 Step 5).
        await removeTestTenants(dataSource, [tenantA, tenantB]);
      }
    } finally {
      await app?.close();
    }
  });

  // Case 0 (F4, F9): the full application schema — the registered surface,
  // not a partial schema factory.
  describe('Case 0: full-schema surface', () => {
    let schema: GraphQLSchema;
    const TARGETS = new Set([
      'LaundryOrder',
      'LaundryOrderLine',
      'Invoice',
      'InvoiceLine',
    ]);

    beforeAll(() => {
      schema = app.get(GraphQLSchemaHost).schema;
    });

    it('exposes no tenantId on any laundry/invoice type, filter, sort or input', () => {
      const checked: string[] = [];
      for (const type of Object.values(schema.getTypeMap())) {
        if (
          !/^(LaundryOrder|Invoice|ReceiveLaundry|WeighLaundry|PriceLaundry|GenerateInvoice)/.test(
            type.name,
          )
        ) {
          continue;
        }
        checked.push(type.name);
        if (
          type instanceof GraphQLObjectType ||
          type instanceof GraphQLInputObjectType
        ) {
          expect({
            type: type.name,
            fields: Object.keys(type.getFields()),
          }).not.toEqual(
            expect.objectContaining({
              fields: expect.arrayContaining(['tenantId']),
            }),
          );
        }
        if (type instanceof GraphQLEnumType) {
          expect(type.getValues().map((v) => v.name)).not.toContain('tenantId');
        }
      }
      expect(checked).toEqual(
        expect.arrayContaining([
          'LaundryOrder',
          'LaundryOrderFilter',
          'LaundryOrderLine',
          'Invoice',
          'InvoiceFilter',
          'InvoiceLine',
          'ReceiveLaundryOrderInput',
          'LaundryOrderRefInput',
          'WeighLaundryOrderInput',
          'PriceLaundryOrderInput',
          'GenerateInvoiceFromOrderInput',
        ]),
      );
      // The relation filters generated for `customer` / `laundryOrder`.
      for (const filter of ['InvoiceFilter', 'LaundryOrderFilter']) {
        const fields = (
          schema.getType(filter) as GraphQLInputObjectType
        ).getFields();
        for (const relation of ['customer', 'laundryOrder']) {
          if (!fields[relation]) continue;
          const relationFilter = getNamedType(
            fields[relation].type,
          ) as GraphQLInputObjectType;
          expect(Object.keys(relationFilter.getFields())).not.toContain(
            'tenantId',
          );
        }
      }
    });

    it('reaches laundry/invoice types only through the scoped inventory', () => {
      const found = new Set<string>();
      for (const type of Object.values(schema.getTypeMap())) {
        if (
          !(type instanceof GraphQLObjectType) ||
          type.name.startsWith('__') ||
          /Connection$/.test(type.name)
        ) {
          continue;
        }
        for (const [fieldName, field] of Object.entries(type.getFields())) {
          let named = getNamedType(field.type);
          if (
            named instanceof GraphQLObjectType &&
            /Connection$/.test(named.name) &&
            named.getFields().nodes
          ) {
            named = getNamedType(named.getFields().nodes.type);
          }
          if (TARGETS.has(named.name)) {
            found.add(`${type.name}.${fieldName}`);
          }
        }
      }
      const expected = [
        'Query.laundryOrders',
        'Query.laundryOrder',
        'Query.invoices',
        'Query.invoice',
        'Invoice.laundryOrder',
        'LaundryOrder.lines',
        'Invoice.lines',
        ...LAUNDRY_MUTATIONS.map((name) => `Mutation.${name}`),
        'Mutation.generateInvoiceFromOrder',
      ];
      expect([...found].sort()).toEqual(expected.sort());
      expect(LAUNDRY_MUTATIONS).toHaveLength(15);

      // No generated aggregate/count/CRUD roots for these types either.
      for (const root of [schema.getQueryType()!, schema.getMutationType()!]) {
        const names = Object.keys(root.getFields()).filter((name) =>
          /laundry|invoice/i.test(name),
        );
        expect(
          names.filter((name) => !expected.includes(`${root.name}.${name}`)),
        ).toEqual([]);
      }
    });
  });

  // Case 1: root scoping.
  describe('Case 1: root scoping', () => {
    it('laundryOrders and invoices return only the caller’s rows', async () => {
      const ids = [orderA, orderB, openA, openB];
      const asB = await ok(
        await gql(cookieB, ORDERS, { f: { id: { in: ids } } }),
      );
      expect(asB.body.data.laundryOrders.totalCount).toBe(2);
      expect(
        asB.body.data.laundryOrders.nodes
          .map((n: { id: string }) => n.id)
          .sort(),
      ).toEqual([orderB, openB].sort());
      const asA = await ok(
        await gql(cookieA, ORDERS, { f: { id: { in: ids } } }),
      );
      expect(
        asA.body.data.laundryOrders.nodes
          .map((n: { id: string }) => n.id)
          .sort(),
      ).toEqual([orderA, openA].sort());

      const invIds = [invoiceA.id, invoiceB.id];
      const invB = await ok(
        await gql(cookieB, INVOICES, { f: { id: { in: invIds } } }),
      );
      expect(invB.body.data.invoices).toEqual({
        nodes: [{ id: invoiceB.id }],
        totalCount: 1,
      });
      const invA = await ok(
        await gql(cookieA, INVOICES, { f: { id: { in: invIds } } }),
      );
      expect(invA.body.data.invoices).toEqual({
        nodes: [{ id: invoiceA.id }],
        totalCount: 1,
      });
    });

    it('laundryOrder(id) / invoice(id) of another tenant is null, like a random id', async () => {
      for (const [query, field, foreign] of [
        [
          'query($id: ID!){ laundryOrder(id:$id){ id } }',
          'laundryOrder',
          orderA,
        ],
        ['query($id: ID!){ invoice(id:$id){ id } }', 'invoice', invoiceA.id],
      ] as const) {
        const asB = await gql(cookieB, query, { id: foreign });
        const random = await gql(cookieB, query, { id: randomUUID() });
        expect(asB.body).toEqual(random.body);
        expect(asB.body).toEqual({ data: { [field]: null } });
        const asA = await ok(await gql(cookieA, query, { id: foreign }));
        expect(asA.body.data[field]).toEqual({ id: foreign });
      }
    });
  });

  // Case 2 (#82 I1, Review Focus 1): relation filters are not an oracle.
  describe('Case 2: relation-filter oracle', () => {
    const cases: Array<
      [
        string,
        'invoices' | 'laundryOrders',
        () => Record<string, unknown>,
        () => string[],
      ]
    > = [
      [
        'invoices by customer name prefix',
        'invoices',
        () => ({ customer: { fullName: { like: `Alpha Laundry ${run}%` } } }),
        () => [invoiceA.id],
      ],
      [
        'invoices by customer id',
        'invoices',
        () => ({ customer: { id: { eq: customerA.id } } }),
        () => [invoiceA.id],
      ],
      [
        'laundryOrders by customer name prefix',
        'laundryOrders',
        () => ({ customer: { fullName: { like: `Alpha Laundry ${run}%` } } }),
        () => [orderA, openA, pricedA2],
      ],
      [
        'invoices by laundry order id',
        'invoices',
        () => ({ laundryOrder: { id: { eq: orderA } } }),
        () => [invoiceA.id],
      ],
      [
        'invoices by laundry order status + customerId',
        'invoices',
        () => ({
          laundryOrder: { status: { eq: 'PRICED' } },
          customerId: { eq: customerA.id },
        }),
        () => [invoiceA.id],
      ],
      [
        'invoices by an or of relation + id',
        'invoices',
        () => ({
          or: [
            { customer: { fullName: { like: `Alpha Laundry ${run}%` } } },
            { id: { eq: invoiceA.id } },
          ],
        }),
        () => [invoiceA.id],
      ],
    ];

    it.each(cases)(
      '%s: B sees nothing (nodes and count), A sees its rows',
      async (_label, root, filter, expectedA) => {
        const full = root === 'invoices' ? INVOICES : ORDERS;
        const count = root === 'invoices' ? INVOICES_COUNT : ORDERS_COUNT;

        const asB = await ok(await gql(cookieB, full, { f: filter() }));
        expect(asB.body.data[root]).toEqual({ nodes: [], totalCount: 0 });
        const countB = await ok(await gql(cookieB, count, { f: filter() }));
        expect(countB.body.data[root]).toEqual({ totalCount: 0 });

        const asA = await ok(await gql(cookieA, full, { f: filter() }));
        expect(
          asA.body.data[root].nodes.map((n: { id: string }) => n.id).sort(),
        ).toEqual(expectedA().sort());
        expect(asA.body.data[root].totalCount).toBe(expectedA().length);
        const countA = await ok(await gql(cookieA, count, { f: filter() }));
        expect(countA.body.data[root].totalCount).toBe(expectedA().length);
      },
    );

    it('a cross-tenant clause neither adds nor removes B’s own rows', async () => {
      for (const [root, filter, own] of [
        [
          'invoices',
          {
            or: [
              { customer: { fullName: { like: `Alpha Laundry ${run}%` } } },
              { id: { eq: invoiceB.id } },
            ],
          },
          invoiceB.id,
        ],
        [
          'invoices',
          {
            and: [
              { id: { eq: invoiceB.id } },
              { customer: { id: { neq: customerA.id } } },
            ],
          },
          invoiceB.id,
        ],
        [
          'laundryOrders',
          {
            or: [
              { customer: { fullName: { like: `Alpha Laundry ${run}%` } } },
              { id: { eq: orderB } },
            ],
          },
          orderB,
        ],
        [
          'laundryOrders',
          {
            and: [
              { id: { eq: orderB } },
              { customer: { id: { neq: customerA.id } } },
            ],
          },
          orderB,
        ],
      ] as const) {
        const res = await ok(
          await gql(cookieB, root === 'invoices' ? INVOICES : ORDERS, {
            f: filter,
          }),
        );
        expect(res.body.data[root]).toEqual({
          nodes: [{ id: own }],
          totalCount: 1,
        });
      }
    });
  });

  // Case 3: nested paths.
  describe('Case 3: nested paths', () => {
    const ORDER_NESTED = `query($id: ID!){ laundryOrder(id:$id){ id customer { id } lines { nodes { id } } } }`;
    const INVOICE_NESTED = `query($id: ID!){ invoice(id:$id){ id customer { id } laundryOrder { id } lines { nodes { id } } } }`;

    async function aIds(): Promise<string[]> {
      const lines = await lineRepository.findBy({ laundryOrderId: orderA });
      const invoiceLines: { id: string }[] = await dataSource.query(
        `SELECT "id" FROM "invoice_line_entity" WHERE "invoiceId" = $1`,
        [invoiceA.id],
      );
      return [
        customerA.id,
        orderA,
        invoiceA.id,
        ...lines.map((l) => l.id),
        ...invoiceLines.map((l) => l.id),
      ];
    }

    it('B gets null through laundryOrder(id) / invoice(id) and no A id leaks', async () => {
      const ids = await aIds();
      const order = await ok(await gql(cookieB, ORDER_NESTED, { id: orderA }));
      expect(order.body.data.laundryOrder).toBeNull();
      const invoice = await ok(
        await gql(cookieB, INVOICE_NESTED, { id: invoiceA.id }),
      );
      expect(invoice.body.data.invoice).toBeNull();
      const body = JSON.stringify([order.body, invoice.body]);
      for (const id of ids) expect(body).not.toContain(id);

      const orderAsA = await ok(
        await gql(cookieA, ORDER_NESTED, { id: orderA }),
      );
      expect(orderAsA.body.data.laundryOrder.customer.id).toBe(customerA.id);
      expect(orderAsA.body.data.laundryOrder.lines.nodes).toHaveLength(2);
      const invAsA = await ok(
        await gql(cookieA, INVOICE_NESTED, { id: invoiceA.id }),
      );
      expect(invAsA.body.data.invoice.laundryOrder.id).toBe(orderA);
      expect(invAsA.body.data.invoice.customer.id).toBe(customerA.id);
      expect(invAsA.body.data.invoice.lines.nodes).toHaveLength(2);
    });

    it('through the authorized root lists, every nested level is the caller’s', async () => {
      const ORDERS_NESTED = `query{ laundryOrders(paging:{limit:50}){ nodes { id customer { id } lines { nodes { id } } } } }`;
      const INVOICES_NESTED = `query{ invoices(paging:{limit:50}){ nodes { id customer { id } laundryOrder { id customer { id } } lines { nodes { id } } } } }`;
      const ids = await aIds();

      const asB = [
        await ok(await gql(cookieB, ORDERS_NESTED)),
        await ok(await gql(cookieB, INVOICES_NESTED)),
      ];
      const bodyB = JSON.stringify(asB.map((r) => r.body));
      for (const id of ids) expect(bodyB).not.toContain(id);
      expect(bodyB).toContain(orderB);
      expect(bodyB).toContain(invoiceB.id);
      expect(bodyB).toContain(customerB.id);

      const bodyA = JSON.stringify([
        (await ok(await gql(cookieA, ORDERS_NESTED))).body,
        (await ok(await gql(cookieA, INVOICES_NESTED))).body,
      ]);
      for (const id of ids) expect(bodyA).toContain(id);
      expect(bodyA).not.toContain(orderB);
      expect(bodyA).not.toContain(invoiceB.id);
    });
  });

  // Case 4 (slice decision 7, Review Focus 3): cross-tenant mutations.
  describe('Case 4: cross-tenant mutations are a missing order', () => {
    it('every order-targeting mutation on A’s order is 404 for B and changes nothing', async () => {
      const before = await orderRepository.findOneByOrFail({ id: openA });
      const mutations: Array<[string, string, Record<string, unknown>]> = [
        ...TRANSITIONS.map(
          (name) =>
            [
              name,
              `mutation($i: LaundryOrderRefInput!){ ${name}(input:$i){ id } }`,
              { orderId: openA },
            ] as [string, string, Record<string, unknown>],
        ),
        ['weighLaundryOrder', WEIGH, { orderId: openA, weightGrams: 900 }],
        [
          'priceLaundryOrder',
          PRICE,
          { orderId: openA, addOns: [], baseServiceId: serviceB.id },
        ],
      ];
      expect(mutations).toHaveLength(14);
      for (const [name, query, input] of mutations) {
        const res = await gql(cookieB, query, { i: input });
        expect({ name, status: errorStatus(res) }).toEqual({
          name,
          status: 404,
        });
        expect(res.body.errors[0].message).toBe(
          `Laundry order ${openA} not found`,
        );
      }

      const generate = await generateAs('B', pricedA2);
      expect(errorStatus(generate)).toBe(404);
      expect(generate.body.errors[0].message).toBe(
        `Laundry order ${pricedA2} not found`,
      );

      const after = await orderRepository.findOneByOrFail({ id: openA });
      expect(after).toEqual(before);
      expect(await lineRepository.countBy({ laundryOrderId: openA })).toBe(0);
      expect(
        await invoiceRepository.countBy({ laundryOrderId: pricedA2 }),
      ).toBe(0);

      // Positive control: A can act on its own order (no allocation).
      const asA = await ok(
        await gql(cookieA, WEIGH, { i: { orderId: openA, weightGrams: 900 } }),
      );
      expect(asA.body.data.weighLaundryOrder.status).toBe('WEIGHED');
    });
  });

  // Case 5: cross-tenant references on the caller's own rows.
  describe('Case 5: cross-tenant references on own rows', () => {
    it('receiveLaundryOrder with another tenant’s customer is 404', async () => {
      const before = await orderRepository.countBy({ tenantId: tenantB });
      const res = await gql(cookieB, RECEIVE, {
        i: { customerId: customerA.id, fulfillmentType: 'PICKUP' },
      });
      expect(errorStatus(res)).toBe(404);
      expect(await orderRepository.countBy({ tenantId: tenantB })).toBe(before);
    });

    it('priceLaundryOrder on B’s own order with A’s service keeps #84’s 400 and changes nothing', async () => {
      const res = await gql(cookieB, PRICE, {
        i: { orderId: weighedB, addOns: [], baseServiceId: serviceA.id },
      });
      expect(errorStatus(res)).toBe(400);
      expect(res.body.errors[0].message).toBe(
        `No effective price for serviceId ${serviceA.id}`,
      );
      const order = await orderRepository.findOneByOrFail({ id: weighedB });
      expect(order.status).toBe('WEIGHED');
      expect(await lineRepository.countBy({ laundryOrderId: weighedB })).toBe(
        0,
      );
    });
  });

  // Case 6 (slice decision 6): tenant persistence.
  describe('Case 6: tenant persistence', () => {
    it('B’s order, its lines and its invoice carry tenantB', async () => {
      const order = await orderRepository.findOneByOrFail({ id: orderB });
      expect(order.tenantId).toBe(tenantB);
      const lines = await lineRepository.findBy({ laundryOrderId: orderB });
      expect(lines).toHaveLength(2);
      expect(new Set(lines.map((l) => l.tenantId))).toEqual(new Set([tenantB]));
      const invoice = await invoiceRepository.findOneByOrFail({
        id: invoiceB.id,
      });
      expect(invoice.tenantId).toBe(tenantB);
      expect(invoice.customerId).toBe(order.customerId);
    });
  });

  // Case 7 (I-2, Review Focus 5): spoofing.
  describe('Case 7: client input cannot supply or widen the tenant', () => {
    it('a tenantId filter is a schema error', async () => {
      for (const query of [INVOICES, ORDERS]) {
        const res = await gql(cookieB, query, {
          f: { tenantId: { eq: tenantA } },
        });
        expect(res.body.errors).toBeDefined();
        expect(res.body.data).toBeUndefined();
      }
    });

    it('an or-widening filter returns nothing of A’s', async () => {
      const res = await ok(
        await gql(cookieB, INVOICES, {
          f: { or: [{ id: { eq: invoiceA.id } }, { id: { is: null } }] },
        }),
      );
      expect(res.body.data.invoices).toEqual({ nodes: [], totalCount: 0 });
    });

    it('an x-tenant-id header is ignored', async () => {
      const res = await ok(
        await gql(
          cookieB,
          `query{ invoices(paging:{limit:50}){ nodes { id } } }`,
          {},
          { 'x-tenant-id': tenantA },
        ),
      );
      const ids = res.body.data.invoices.nodes.map((n: { id: string }) => n.id);
      expect(ids).toContain(invoiceB.id);
      expect(ids).not.toContain(invoiceA.id);
    });

    it('a tenantId on receiveLaundryOrder input is a validation error and creates nothing', async () => {
      const before = await orderRepository.countBy({ tenantId: tenantA });
      const beforeB = await orderRepository.countBy({ tenantId: tenantB });
      const res = await gql(cookieB, RECEIVE, {
        i: {
          customerId: customerB.id,
          fulfillmentType: 'PICKUP',
          tenantId: tenantA,
        },
      });
      expect(res.body.errors).toBeDefined();
      expect(res.body.data).toBeUndefined();
      expect(await orderRepository.countBy({ tenantId: tenantA })).toBe(before);
      expect(await orderRepository.countBy({ tenantId: tenantB })).toBe(
        beforeB,
      );
    });
  });

  // Case 8: role boundary (RFC §4.2).
  describe('Case 8: Super Admin is refused by role', () => {
    it.each([
      ['laundryOrders', () => [ORDERS, {}] as const],
      [
        'laundryOrder',
        () =>
          [
            'query($id: ID!){ laundryOrder(id:$id){ id } }',
            { id: orderA },
          ] as const,
      ],
      ['invoices', () => [INVOICES, {}] as const],
      [
        'invoice',
        () =>
          [
            'query($id: ID!){ invoice(id:$id){ id } }',
            { id: invoiceA.id },
          ] as const,
      ],
      [
        'receiveLaundryOrder',
        () =>
          [
            RECEIVE,
            { i: { customerId: customerA.id, fulfillmentType: 'PICKUP' } },
          ] as const,
      ],
      [
        'generateInvoiceFromOrder',
        () =>
          [
            GENERATE,
            { i: { laundryOrderId: pricedA2, paymentTerms: 'PAY_NOW' } },
          ] as const,
      ],
    ])('%s ⇒ 403 with no tenant data', async (_name, operation) => {
      const [query, variables] = operation();
      const res = await gql(cookieSuperAdmin, query, variables);
      expect(errorStatus(res)).toBe(403);
      const body = JSON.stringify(res.body);
      for (const id of [orderA, orderB, invoiceA.id, invoiceB.id]) {
        expect(body).not.toContain(id);
      }
    });
  });

  // Case 9 (I-3, Review Focus 2): per-tenant numbering under concurrency.
  // No A or B invoice was generated since setup (case 4's attempts failed
  // before the transaction, so they allocated nothing).
  describe('Case 9: per-tenant, concurrency-safe numbering', () => {
    it('each tenant numbers independently; a per-tenant duplicate string is legal', async () => {
      expect(suffix(invoiceA.invoiceNumber)).toBe(1);
      expect(suffix(invoiceB.invoiceNumber)).toBe(1);
      expect(invoiceA.invoiceNumber).toBe(invoiceB.invoiceNumber);
      expect(await counterOf(tenantA)).toBe(1);
      expect(await counterOf(tenantB)).toBe(1);
    });

    it('five parallel generates in one tenant get 2..6; the other tenant is untouched', async () => {
      const orders: string[] = [];
      for (let index = 0; index < 5; index += 1) {
        orders.push(await pricedOrderAs('A'));
      }
      const results = await Promise.all(
        orders.map((orderId) => generateAs('A', orderId)),
      );
      for (const res of results) expect(res.body.errors).toBeUndefined();
      expect(
        results
          .map((res) =>
            suffix(
              (
                res.body.data.generateInvoiceFromOrder as {
                  invoiceNumber: string;
                }
              ).invoiceNumber,
            ),
          )
          .sort((x, y) => x - y),
      ).toEqual([2, 3, 4, 5, 6]);
      expect(await counterOf(tenantA)).toBe(6);
      expect(await counterOf(tenantB)).toBe(1);
    });

    it('a racing duplicate generate: one success, one 409, counter +1', async () => {
      const orderId = await pricedOrderAs('A');
      const [first, second] = await Promise.all([
        generateAs('A', orderId),
        generateAs('A', orderId),
      ]);
      const statuses = [first, second].map((res) =>
        res.body.errors ? errorStatus(res) : 'ok',
      );
      expect(statuses.sort()).toEqual([409, 'ok'].sort());
      const conflict = [first, second].find((res) => res.body.errors)!;
      expect(conflict.body.errors[0].message).toBe(
        'An invoice already exists for this laundry order',
      );
      expect(await counterOf(tenantA)).toBe(7);
      expect(await invoiceRepository.countBy({ laundryOrderId: orderId })).toBe(
        1,
      );
    });
  });

  // Case 10 (I-1 database half): the composite FKs reject what the
  // application never writes.
  describe('Case 10: database backstop', () => {
    const insertLine = (
      tenantId: string,
      laundryOrderId: string,
      target: { addOnId: string } | { serviceId: string },
    ) =>
      dataSource.query(
        `INSERT INTO "laundry_order_line_entity" ("tenantId", "laundryOrderId", "serviceId", "addOnId", "pricingSnapshotRateMinorUnits", "pricingSnapshotUnit", "pricingSnapshotQuantity", "pricingSnapshotAmountMinorUnits", "pricingSnapshotMinimumChargeApplied") VALUES ($1, $2, $3, $4, 1000, 'FLAT', 1, 1000, false)`,
        [
          tenantId,
          laundryOrderId,
          'serviceId' in target ? target.serviceId : null,
          'addOnId' in target ? target.addOnId : null,
        ],
      );
    const insertInvoice = (
      tenantId: string,
      laundryOrderId: string,
      customerId: string,
    ) =>
      dataSource.query(
        `INSERT INTO "invoice_entity" ("tenantId", "invoiceNumber", "laundryOrderId", "customerId", "subtotalMinorUnits", "discountMinorUnits", "totalMinorUnits", "amountPaidMinorUnits", "paymentStatus", "paymentTerms", "issueDate") VALUES ($1, 'INV-2030-999999', $2, $3, 1000, 0, 1000, 0, 'UNPAID', 'PAY_NOW', now())`,
        [tenantId, laundryOrderId, customerId],
      );
    const rejectsWith = async (
      promise: Promise<unknown>,
      constraint: string,
    ) => {
      const error: unknown = await promise.then(
        () => undefined,
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(QueryFailedError);
      expect(
        (error as { driverError: { constraint: string } }).driverError
          .constraint,
      ).toBe(constraint);
    };

    it('rejects every tenant-mismatched reference', async () => {
      await rejectsWith(
        dataSource.query(
          `INSERT INTO "laundry_order_entity" ("tenantId", "customerId", "fulfillmentType") VALUES ($1, $2, 'PICKUP')`,
          [tenantB, customerA.id],
        ),
        'fk_laundry_order_customer_tenant',
      );
      await rejectsWith(
        insertLine(tenantB, openB, { serviceId: serviceA.id }),
        'fk_laundry_order_line_service_tenant',
      );
      await rejectsWith(
        insertLine(tenantB, openB, { addOnId: addOnA.id }),
        'fk_laundry_order_line_add_on_tenant',
      );
      await rejectsWith(
        insertLine(tenantA, openB, { serviceId: serviceA.id }),
        'fk_laundry_order_line_order_tenant',
      );
      await rejectsWith(
        insertInvoice(tenantB, pricedA2, customerB.id),
        'fk_invoice_laundry_order_tenant',
      );
      await rejectsWith(
        insertInvoice(tenantB, weighedB, customerA.id),
        'fk_invoice_customer_tenant',
      );
    });
  });

  // Case 11 (slice decision 11): audit tags.
  describe('Case 11: audit events carry the tenant', () => {
    it('A’s laundry_order.* and invoice.generated events are TENANT-scoped to tenantA', async () => {
      const orderEvents = await auditEventRepository.find({
        where: { entityId: orderA, entityType: 'laundry_order' },
      });
      expect(orderEvents.map((e) => e.action).sort()).toEqual(
        [
          'laundry_order.priced',
          'laundry_order.received',
          'laundry_order.weighed',
        ].sort(),
      );
      const invoiceEvents = await auditEventRepository.find({
        where: { entityId: invoiceA.id, entityType: 'invoice' },
      });
      expect(invoiceEvents.map((e) => e.action)).toEqual(['invoice.generated']);
      for (const event of [...orderEvents, ...invoiceEvents]) {
        expect({
          actorId: event.actorId,
          scope: event.scope,
          tenantId: event.tenantId,
        }).toEqual({ actorId: ownerAId, scope: 'TENANT', tenantId: tenantA });
      }
    });
  });
});
