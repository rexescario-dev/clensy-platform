import { randomUUID } from 'crypto';
import { LaundryOrderStatus } from '../../../src/modules/laundry/domain/laundry-order-status';
import { gqlCall, Probe } from '../probe';
import { connectionProbe, getByIdProbe } from './shapes';

const GENERATE = `mutation Gate($input: GenerateInvoiceFromOrderInput!) { generateInvoiceFromOrder(input: $input) { id } }`;
const RECORD = `mutation Gate($input: RecordInvoicePaymentInput!) { recordInvoicePayment(input: $input) { id } }`;
const REFUND = `mutation Gate($input: RefundInvoicePaymentInput!) { refundInvoicePayment(input: $input) { id } }`;

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
  // #39 spec §4.7. Each call carries a fresh idempotency key, so no call
  // is an idempotent replay of another.
  {
    crossTenant: [
      {
        call: ({ foreign }) =>
          gqlCall('recordInvoicePayment', RECORD, {
            input: recordInput(foreign[0]),
          }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.invoiceId],
        missing: { kind: 'error', status: 404 },
        name: 'reference invoiceId belongs to the other tenant',
      },
    ],
    key: 'Mutation.recordInvoicePayment',
    ok: { kind: 'createdInOwnTenant', table: 'payment_entity' },
    prepare: async (fixtures, tenant) => ({
      invoiceId: await fixtures.invoice(tenant),
    }),
    sameTenant: ({ prepared }) =>
      gqlCall('recordInvoicePayment', RECORD, {
        input: recordInput(prepared.invoiceId),
      }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign }) =>
          gqlCall('refundInvoicePayment', REFUND, {
            input: refundInput(foreign[0]),
          }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.paymentId],
        missing: { kind: 'error', status: 404 },
        name: 'reference paymentId belongs to the other tenant',
      },
    ],
    key: 'Mutation.refundInvoicePayment',
    ok: { kind: 'createdInOwnTenant', table: 'payment_entity' },
    prepare: (fixtures, tenant) => fixtures.invoiceWithPayment(tenant),
    sameTenant: ({ prepared }) =>
      gqlCall('refundInvoicePayment', REFUND, {
        input: refundInput(prepared.paymentId),
      }),
  },
];

function recordInput(invoiceId: string): Record<string, unknown> {
  return {
    invoiceId,
    amountMinorUnits: 100,
    idempotencyKey: randomUUID(),
    method: 'CASH',
  };
}

function refundInput(paymentId: string): Record<string, unknown> {
  return {
    paymentId,
    amountMinorUnits: 100,
    idempotencyKey: randomUUID(),
    method: 'CASH',
  };
}
