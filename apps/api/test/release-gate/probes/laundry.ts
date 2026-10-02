import { LaundryFulfillmentType } from '../../../src/modules/laundry/domain/laundry-fulfillment-type';
import { LaundryOrderStatus } from '../../../src/modules/laundry/domain/laundry-order-status';
import { gqlCall, Probe } from '../probe';
import { connectionProbe, getByIdProbe } from './shapes';

const RECEIVE = `mutation Gate($input: ReceiveLaundryOrderInput!) { receiveLaundryOrder(input: $input) { id } }`;
const WEIGH = `mutation Gate($input: WeighLaundryOrderInput!) { weighLaundryOrder(input: $input) { id } }`;
const PRICE = `mutation Gate($input: PriceLaundryOrderInput!) { priceLaundryOrder(input: $input) { id } }`;

function transitionProbe(
  field: string,
  from: LaundryOrderStatus,
  fulfillmentType: LaundryFulfillmentType = LaundryFulfillmentType.PICKUP,
): Probe {
  const document = `mutation Gate($input: LaundryOrderRefInput!) { ${field}(input: $input) { id } }`;
  return {
    crossTenant: [
      {
        call: ({ foreign }) =>
          gqlCall(field, document, { input: { orderId: foreign[0] } }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.orderId],
        missing: { kind: 'error', status: 404 },
        name: 'target order belongs to the other tenant',
      },
    ],
    key: `Mutation.${field}`,
    ok: { id: ({ prepared }) => prepared.orderId, kind: 'returnsId' },
    prepare: async (fixtures, tenant) => ({
      orderId: await fixtures.laundryOrder(tenant, from, fulfillmentType),
    }),
    sameTenant: ({ prepared }) =>
      gqlCall(field, document, { input: { orderId: prepared.orderId } }),
  };
}

const { AWAITING_PICKUP, PAID, PRICED, PROCESSING, READY, RECEIVED, WEIGHED } =
  LaundryOrderStatus;

export const LAUNDRY_PROBES: readonly Probe[] = [
  getByIdProbe({
    id: (t) => t.laundryOrderId,
    field: 'laundryOrder',
    key: 'Query.laundryOrder',
    missing: { kind: 'null' },
  }),
  connectionProbe({
    id: (t) => t.laundryOrderId,
    field: 'laundryOrders',
    filterType: 'LaundryOrderFilter',
    key: 'Query.laundryOrders',
    table: 'laundry_order_entity',
  }),
  {
    crossTenant: [
      {
        call: ({ foreign }) =>
          gqlCall('receiveLaundryOrder', RECEIVE, {
            input: { customerId: foreign[0], fulfillmentType: 'PICKUP' },
          }),
        foreignIds: (victim) => [victim.customerId],
        missing: { kind: 'error', status: 404 },
        name: 'reference customerId belongs to the other tenant',
      },
    ],
    key: 'Mutation.receiveLaundryOrder',
    ok: { kind: 'createdInOwnTenant', table: 'laundry_order_entity' },
    sameTenant: ({ own }) =>
      gqlCall('receiveLaundryOrder', RECEIVE, {
        input: { customerId: own.customerId, fulfillmentType: 'PICKUP' },
      }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign }) =>
          gqlCall('weighLaundryOrder', WEIGH, {
            input: { orderId: foreign[0], weightGrams: 2500 },
          }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.orderId],
        missing: { kind: 'error', status: 404 },
        name: 'target order belongs to the other tenant',
      },
    ],
    key: 'Mutation.weighLaundryOrder',
    ok: { id: ({ prepared }) => prepared.orderId, kind: 'returnsId' },
    prepare: async (fixtures, tenant) => ({
      orderId: await fixtures.laundryOrder(tenant, RECEIVED),
    }),
    sameTenant: ({ prepared }) =>
      gqlCall('weighLaundryOrder', WEIGH, {
        input: { orderId: prepared.orderId, weightGrams: 2500 },
      }),
  },
  {
    // A foreign service/add-on has no effective price for the caller's
    // tenant: 400 "No effective price for …" (#84/#87 suites), the same
    // answer a never-existed id gets — the control proves it.
    crossTenant: [
      {
        call: ({ foreign, own }) =>
          gqlCall('priceLaundryOrder', PRICE, {
            input: {
              addOns: [{ addOnId: own.addOnId }],
              baseServiceId: own.serviceId,
              orderId: foreign[0],
            },
          }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.orderId],
        missing: { kind: 'error', status: 404 },
        name: 'target order belongs to the other tenant',
      },
      {
        call: ({ foreign, own, prepared }) =>
          gqlCall('priceLaundryOrder', PRICE, {
            input: {
              addOns: [{ addOnId: own.addOnId }],
              baseServiceId: foreign[0],
              orderId: prepared.orderId,
            },
          }),
        foreignIds: (victim) => [victim.serviceId],
        missing: { kind: 'error', status: 400 },
        name: 'reference baseServiceId belongs to the other tenant',
      },
      {
        call: ({ foreign, own, prepared }) =>
          gqlCall('priceLaundryOrder', PRICE, {
            input: {
              addOns: [{ addOnId: foreign[0] }],
              baseServiceId: own.serviceId,
              orderId: prepared.orderId,
            },
          }),
        foreignIds: (victim) => [victim.addOnId],
        missing: { kind: 'error', status: 400 },
        name: 'reference addOnId belongs to the other tenant',
      },
    ],
    key: 'Mutation.priceLaundryOrder',
    ok: { id: ({ prepared }) => prepared.orderId, kind: 'returnsId' },
    prepare: async (fixtures, tenant) => ({
      orderId: await fixtures.laundryOrder(tenant, WEIGHED),
    }),
    sameTenant: ({ own, prepared }) =>
      gqlCall('priceLaundryOrder', PRICE, {
        input: {
          addOns: [{ addOnId: own.addOnId }],
          baseServiceId: own.serviceId,
          orderId: prepared.orderId,
        },
      }),
  },
  transitionProbe('markLaundryOrderAwaitingPayment', PRICED),
  transitionProbe('markLaundryOrderPaid', PRICED),
  transitionProbe('startLaundryProcessing', PAID),
  transitionProbe('markLaundryOrderReady', PROCESSING),
  transitionProbe(
    'markLaundryOrderAwaitingPickup',
    READY,
    LaundryFulfillmentType.PICKUP,
  ),
  transitionProbe(
    'markLaundryOrderAwaitingDelivery',
    READY,
    LaundryFulfillmentType.DELIVERY,
  ),
  transitionProbe('completeLaundryOrder', AWAITING_PICKUP),
  transitionProbe('cancelLaundryOrder', RECEIVED),
  transitionProbe('rejectLaundryOrder', RECEIVED),
  transitionProbe('markLaundryOrderLost', PROCESSING),
  transitionProbe('markLaundryOrderDamaged', PROCESSING),
  transitionProbe('refundLaundryOrder', PAID),
];
