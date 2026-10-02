import { gqlCall, Probe } from '../probe';
import { connectionProbe, getByIdProbe } from './shapes';

const NO_TENANT_INPUT =
  'input carries no tenant-owned id; the tenant comes only from the principal (RFC §4.5), pinned by createdInOwnTenant';

const UPDATE_CUSTOMER = `mutation Gate($id: ID!, $input: UpdateCustomerInput!) { updateCustomer(id: $id, input: $input) { id } }`;
const CREATE_PROPERTY = `mutation Gate($customerId: ID!, $input: CreatePropertyInput!) { createProperty(customerId: $customerId, input: $input) { id } }`;
const UPDATE_PROPERTY = `mutation Gate($id: ID!, $input: UpdatePropertyInput!) { updateProperty(id: $id, input: $input) { id } }`;
const CUSTOMER_PROPERTIES = `query Gate($customerId: ID!) { customerProperties(customerId: $customerId) { totalCount nodes { id } } }`;

const propertyInput = (unique: string) => ({
  addressLine1: '2 Gate Street',
  city: 'Gate City',
  label: `Gate Property ${unique}`,
  postalCode: '00000',
  region: 'GC',
});

export const CUSTOMER_PROBES: readonly Probe[] = [
  getByIdProbe({
    id: (t) => t.customerId,
    field: 'customer',
    key: 'Query.customer',
    missing: { kind: 'null' },
  }),
  connectionProbe({
    id: (t) => t.customerId,
    field: 'customers',
    filterType: 'CustomerFilter',
    key: 'Query.customers',
    table: 'customer_entity',
  }),
  getByIdProbe({
    id: (t) => t.propertyId,
    field: 'property',
    key: 'Query.property',
    missing: { kind: 'null' },
  }),
  {
    crossTenant: [
      {
        call: ({ foreign }) =>
          gqlCall('customerProperties', CUSTOMER_PROPERTIES, {
            customerId: foreign[0],
          }),
        foreignIds: (victim) => [victim.customerId],
        missing: { kind: 'emptyConnection' },
        name: 'customerId belongs to the other tenant',
      },
    ],
    key: 'Query.customerProperties',
    ok: { id: ({ own }) => own.propertyId, kind: 'listIncludes' },
    sameTenant: ({ own }) =>
      gqlCall('customerProperties', CUSTOMER_PROPERTIES, {
        customerId: own.customerId,
      }),
  },
  {
    crossTenant: [],
    key: 'Mutation.createCustomer',
    noCrossTenantInput: NO_TENANT_INPUT,
    ok: { kind: 'createdInOwnTenant', table: 'customer_entity' },
    sameTenant: ({ unique }) =>
      gqlCall(
        'createCustomer',
        `mutation Gate($input: CreateCustomerInput!) { createCustomer(input: $input) { id } }`,
        {
          input: {
            email: `gate-new-${unique}@example.com`,
            fullName: `Gate New ${unique}`,
            phone: '555-0102',
          },
        },
      ),
  },
  {
    crossTenant: [
      {
        call: ({ foreign, unique }) =>
          gqlCall('updateCustomer', UPDATE_CUSTOMER, {
            id: foreign[0],
            input: { notes: `gate ${unique}` },
          }),
        foreignIds: (victim) => [victim.customerId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
    ],
    key: 'Mutation.updateCustomer',
    ok: { id: ({ own }) => own.customerId, kind: 'returnsId' },
    sameTenant: ({ own, unique }) =>
      gqlCall('updateCustomer', UPDATE_CUSTOMER, {
        id: own.customerId,
        input: { notes: `gate ${unique}` },
      }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign, unique }) =>
          gqlCall('createProperty', CREATE_PROPERTY, {
            customerId: foreign[0],
            input: propertyInput(unique),
          }),
        foreignIds: (victim) => [victim.customerId],
        missing: { kind: 'error', status: 404 },
        name: 'reference customerId belongs to the other tenant',
      },
    ],
    key: 'Mutation.createProperty',
    ok: { kind: 'createdInOwnTenant', table: 'property_entity' },
    sameTenant: ({ own, unique }) =>
      gqlCall('createProperty', CREATE_PROPERTY, {
        customerId: own.customerId,
        input: propertyInput(unique),
      }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign, unique }) =>
          gqlCall('updateProperty', UPDATE_PROPERTY, {
            id: foreign[0],
            input: { accessNotes: `gate ${unique}` },
          }),
        foreignIds: (victim) => [victim.propertyId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
    ],
    key: 'Mutation.updateProperty',
    ok: { id: ({ own }) => own.propertyId, kind: 'returnsId' },
    sameTenant: ({ own, unique }) =>
      gqlCall('updateProperty', UPDATE_PROPERTY, {
        id: own.propertyId,
        input: { accessNotes: `gate ${unique}` },
      }),
  },
];
