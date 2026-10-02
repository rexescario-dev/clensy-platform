import { gqlCall, Probe, VariantArgs } from '../probe';
import type { TenantWorld } from '../two-tenant-world';
import { connectionProbe, getByIdProbe } from './shapes';

const CREATE = `mutation Gate($input: CreateBookingInput!) { createBooking(createBookingInput: $input) { id } }`;
const UPDATE = `mutation Gate($input: UpdateBookingInput!) { updateBooking(updateBookingInput: $input) { id } }`;
const REMOVE = `mutation Gate($id: ID!) { removeBooking(id: $id) { id } }`;

export const scheduledAt = (): string =>
  new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

export function bookingInput(
  own: TenantWorld,
  override: Record<string, string> = {},
): Record<string, string> {
  return {
    customerId: own.customerId,
    propertyId: own.propertyId,
    serviceId: own.serviceId,
    teamId: own.teamId,
    scheduledAt: scheduledAt(),
    ...override,
  };
}

// RFC §4.4 booking references: customer, property, service, team. Shared
// with the REST probe so each surface keeps its own probe (decision 6).
export const BOOKING_REFERENCES: readonly (keyof TenantWorld &
  ('customerId' | 'propertyId' | 'serviceId' | 'teamId'))[] = [
  'customerId',
  'propertyId',
  'serviceId',
  'teamId',
];

export const BOOKING_PROBES: readonly Probe[] = [
  // `booking(id)` is non-nullable: a missing row is a 404 error (#85 suite).
  getByIdProbe({
    id: (t) => t.bookingId,
    field: 'booking',
    key: 'Query.booking',
    missing: { kind: 'error', status: 404 },
  }),
  connectionProbe({
    id: (t) => t.bookingId,
    field: 'bookings',
    filterType: 'BookingFilter',
    key: 'Query.bookings',
    table: 'booking_entity',
  }),
  {
    crossTenant: BOOKING_REFERENCES.map((reference) => ({
      call: ({ foreign, own }: VariantArgs) =>
        gqlCall('createBooking', CREATE, {
          input: bookingInput(own, { [reference]: foreign[0] }),
        }),
      foreignIds: (victim: TenantWorld) => [victim[reference]],
      missing: { kind: 'error', status: 404 } as const,
      name: `reference ${reference} belongs to the other tenant`,
    })),
    key: 'Mutation.createBooking',
    ok: { kind: 'createdInOwnTenant', table: 'booking_entity' },
    sameTenant: ({ own }) =>
      gqlCall('createBooking', CREATE, { input: bookingInput(own) }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign }) =>
          gqlCall('updateBooking', UPDATE, {
            input: { id: foreign[0], scheduledAt: scheduledAt() },
          }),
        foreignIds: (victim) => [victim.bookingId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
      {
        call: ({ foreign, own }) =>
          gqlCall('updateBooking', UPDATE, {
            input: { id: own.bookingId, teamId: foreign[0] },
          }),
        foreignIds: (victim) => [victim.teamId],
        missing: { kind: 'error', status: 404 },
        name: 'reference teamId belongs to the other tenant',
      },
    ],
    key: 'Mutation.updateBooking',
    ok: { id: ({ own }) => own.bookingId, kind: 'returnsId' },
    sameTenant: ({ own }) =>
      gqlCall('updateBooking', UPDATE, {
        input: { id: own.bookingId, scheduledAt: scheduledAt() },
      }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign }) =>
          gqlCall('removeBooking', REMOVE, { id: foreign[0] }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.bookingId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
    ],
    key: 'Mutation.removeBooking',
    ok: { id: ({ prepared }) => prepared.bookingId, kind: 'returnsId' },
    prepare: async (fixtures, tenant) => ({
      bookingId: await fixtures.booking(tenant),
    }),
    sameTenant: ({ prepared }) =>
      gqlCall('removeBooking', REMOVE, { id: prepared.bookingId }),
  },
];
