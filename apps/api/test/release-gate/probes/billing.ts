import { LaundryOrderStatus } from '../../../src/modules/laundry/domain/laundry-order-status';
import { gqlCall, Probe } from '../probe';
import { connectionProbe, getByIdProbe } from './shapes';

const GENERATE = `mutation Gate($input: GenerateInvoiceFromOrderInput!) { generateInvoiceFromOrder(input: $input) { id } }`;

export const BILLING_PROBES: readonly Probe[] = [
  getByIdProbe({
    id: (t) => t.invoiceId,
    field: 'invoice',
    key: 'Query.invoice',
    missing: { kind: 'null' },
  }),
  connectionProbe({
    id: (t) => t.invoiceId,
    field: 'invoices',
    filterType: 'InvoiceFilter',
    key: 'Query.invoices',
    table: 'invoice_entity',
  }),
  {
    crossTenant: [
      {
        call: ({ foreign }) =>
          gqlCall('generateInvoiceFromOrder', GENERATE, {
            input: { laundryOrderId: foreign[0], paymentTerms: 'PAY_NOW' },
          }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.orderId],
        missing: { kind: 'error', status: 404 },
        name: 'reference laundryOrderId belongs to the other tenant',
      },
    ],
    key: 'Mutation.generateInvoiceFromOrder',
    ok: { kind: 'createdInOwnTenant', table: 'invoice_entity' },
    prepare: async (fixtures, tenant) => ({
      orderId: await fixtures.laundryOrder(tenant, LaundryOrderStatus.PRICED),
    }),
    sameTenant: ({ prepared }) =>
      gqlCall('generateInvoiceFromOrder', GENERATE, {
        input: { laundryOrderId: prepared.orderId, paymentTerms: 'PAY_NOW' },
      }),
  },
];
