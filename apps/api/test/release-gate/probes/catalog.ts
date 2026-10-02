import { gqlCall, Probe } from '../probe';
import { connectionProbe, getByIdProbe } from './shapes';

const NO_TENANT_INPUT =
  'input carries no tenant-owned id; the tenant comes only from the principal (RFC §4.5), pinned by createdInOwnTenant';
const ACTIVE_PRICING = `query Gate($serviceId: ID!) { activePricing(serviceId: $serviceId) { id } }`;
const UPDATE_SERVICE = `mutation Gate($id: ID!, $input: UpdateServiceInput!) { updateService(id: $id, input: $input) { id } }`;
const UPDATE_ADD_ON = `mutation Gate($id: ID!, $input: UpdateAddOnInput!) { updateAddOn(id: $id, input: $input) { id } }`;
const CREATE_PRICING_RULE = `mutation Gate($input: CreatePricingRuleInput!) { createPricingRule(input: $input) { id } }`;

export const CATALOG_PROBES: readonly Probe[] = [
  getByIdProbe({
    id: (t) => t.serviceId,
    field: 'service',
    key: 'Query.service',
    missing: { kind: 'null' },
  }),
  connectionProbe({
    id: (t) => t.serviceId,
    field: 'services',
    filterType: 'ServiceFilter',
    key: 'Query.services',
    table: 'service_entity',
  }),
  connectionProbe({
    id: (t) => t.addOnId,
    field: 'addOns',
    filterType: 'AddOnFilter',
    key: 'Query.addOns',
    table: 'add_on_entity',
  }),
  {
    // Catalog §4.2: activePricing throws NotFound for a service that does not exist.
    crossTenant: [
      {
        call: ({ foreign }) =>
          gqlCall('activePricing', ACTIVE_PRICING, { serviceId: foreign[0] }),
        foreignIds: (victim) => [victim.serviceId],
        missing: { kind: 'error', status: 404 },
        name: 'serviceId belongs to the other tenant',
      },
    ],
    key: 'Query.activePricing',
    ok: { id: ({ own }) => own.pricingRuleId, kind: 'returnsId' },
    sameTenant: ({ own }) =>
      gqlCall('activePricing', ACTIVE_PRICING, { serviceId: own.serviceId }),
  },
  {
    crossTenant: [],
    key: 'Mutation.createService',
    noCrossTenantInput: NO_TENANT_INPUT,
    ok: { kind: 'createdInOwnTenant', table: 'service_entity' },
    sameTenant: ({ unique }) =>
      gqlCall(
        'createService',
        `mutation Gate($input: CreateServiceInput!) { createService(input: $input) { id } }`,
        {
          input: { durationMinutes: 45, name: `Gate New Service ${unique}` },
        },
      ),
  },
  {
    // Description only: renaming or deactivating the shared service would break later probes.
    crossTenant: [
      {
        call: ({ foreign, unique }) =>
          gqlCall('updateService', UPDATE_SERVICE, {
            id: foreign[0],
            input: { description: `gate ${unique}` },
          }),
        foreignIds: (victim) => [victim.serviceId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
    ],
    key: 'Mutation.updateService',
    ok: { id: ({ own }) => own.serviceId, kind: 'returnsId' },
    sameTenant: ({ own, unique }) =>
      gqlCall('updateService', UPDATE_SERVICE, {
        id: own.serviceId,
        input: { description: `gate ${unique}` },
      }),
  },
  {
    crossTenant: [],
    key: 'Mutation.createAddOn',
    noCrossTenantInput: NO_TENANT_INPUT,
    ok: { kind: 'createdInOwnTenant', table: 'add_on_entity' },
    sameTenant: ({ unique }) =>
      gqlCall(
        'createAddOn',
        `mutation Gate($input: CreateAddOnInput!) { createAddOn(input: $input) { id } }`,
        {
          input: { name: `Gate New Add-on ${unique}`, priceMinorUnits: 250 },
        },
      ),
  },
  {
    crossTenant: [
      {
        call: ({ foreign, unique }) =>
          gqlCall('updateAddOn', UPDATE_ADD_ON, {
            id: foreign[0],
            input: { description: `gate ${unique}` },
          }),
        foreignIds: (victim) => [victim.addOnId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
    ],
    key: 'Mutation.updateAddOn',
    ok: { id: ({ own }) => own.addOnId, kind: 'returnsId' },
    sameTenant: ({ own, unique }) =>
      gqlCall('updateAddOn', UPDATE_ADD_ON, {
        id: own.addOnId,
        input: { description: `gate ${unique}` },
      }),
  },
  {
    // Fresh, unpriced targets per call so the shared service's active rule never changes.
    crossTenant: [
      {
        call: ({ foreign }) =>
          gqlCall('createPricingRule', CREATE_PRICING_RULE, {
            input: {
              priceMinorUnits: 1200,
              serviceId: foreign[0],
              unit: 'PER_SERVICE',
            },
          }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.serviceId],
        missing: { kind: 'error', status: 404 },
        name: 'reference serviceId belongs to the other tenant',
      },
      {
        call: ({ foreign }) =>
          gqlCall('createPricingRule', CREATE_PRICING_RULE, {
            input: { addOnId: foreign[0], priceMinorUnits: 200, unit: 'FLAT' },
          }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.addOnId],
        missing: { kind: 'error', status: 404 },
        name: 'reference addOnId belongs to the other tenant',
      },
    ],
    key: 'Mutation.createPricingRule',
    ok: { kind: 'createdInOwnTenant', table: 'pricing_rule_entity' },
    prepare: async (fixtures, tenant) => ({
      addOnId: await fixtures.addOn(tenant.tenantId, { priced: false }),
      serviceId: (await fixtures.service(tenant.tenantId, { priced: false }))
        .serviceId,
    }),
    sameTenant: ({ prepared }) =>
      gqlCall('createPricingRule', CREATE_PRICING_RULE, {
        input: {
          priceMinorUnits: 1200,
          serviceId: prepared.serviceId,
          unit: 'PER_SERVICE',
        },
      }),
  },
];
