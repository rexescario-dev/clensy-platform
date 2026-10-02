import { Probe, restCall, VariantArgs } from '../probe';
import type { TenantWorld } from '../two-tenant-world';
import { BOOKING_REFERENCES, bookingInput, scheduledAt } from './bookings';

// REST /bookings is its own tenant surface (RFC §4.5; #85; #91 decision 1):
// its own probes, roles pinned separately in the matrix.
export const BOOKING_REST_PROBES: readonly Probe[] = [
  {
    crossTenant: [
      {
        call: () => restCall('GET', '/bookings'),
        foreignIds: (victim) => [victim.bookingId],
        missing: { kind: 'excludes', table: 'booking_entity' },
        name: 'unfiltered list',
      },
    ],
    key: 'GET /bookings',
    ok: { id: ({ own }) => own.bookingId, kind: 'listIncludes' },
    sameTenant: () => restCall('GET', '/bookings'),
  },
  {
    crossTenant: [
      {
        call: ({ foreign }) => restCall('GET', `/bookings/${foreign[0]}`),
        foreignIds: (victim) => [victim.bookingId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
    ],
    key: 'GET /bookings/:id',
    ok: { id: ({ own }) => own.bookingId, kind: 'returnsId' },
    sameTenant: ({ own }) => restCall('GET', `/bookings/${own.bookingId}`),
  },
  {
    crossTenant: BOOKING_REFERENCES.map((reference) => ({
      call: ({ foreign, own }: VariantArgs) =>
        restCall(
          'POST',
          '/bookings',
          bookingInput(own, { [reference]: foreign[0] }),
        ),
      foreignIds: (victim: TenantWorld) => [victim[reference]],
      missing: { kind: 'error', status: 404 } as const,
      name: `reference ${reference} belongs to the other tenant`,
    })),
    key: 'POST /bookings',
    ok: { kind: 'createdInOwnTenant', table: 'booking_entity' },
    sameTenant: ({ own }) => restCall('POST', '/bookings', bookingInput(own)),
  },
  {
    crossTenant: [
      {
        call: ({ foreign }) =>
          restCall('PATCH', `/bookings/${foreign[0]}`, {
            scheduledAt: scheduledAt(),
          }),
        foreignIds: (victim) => [victim.bookingId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
      {
        call: ({ foreign, own }) =>
          restCall('PATCH', `/bookings/${own.bookingId}`, {
            teamId: foreign[0],
          }),
        foreignIds: (victim) => [victim.teamId],
        missing: { kind: 'error', status: 404 },
        name: 'reference teamId belongs to the other tenant',
      },
    ],
    key: 'PATCH /bookings/:id',
    ok: { id: ({ own }) => own.bookingId, kind: 'returnsId' },
    sameTenant: ({ own }) =>
      restCall('PATCH', `/bookings/${own.bookingId}`, {
        scheduledAt: scheduledAt(),
      }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign }) => restCall('DELETE', `/bookings/${foreign[0]}`),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.bookingId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
    ],
    key: 'DELETE /bookings/:id',
    ok: { id: ({ prepared }) => prepared.bookingId, kind: 'returnsId' },
    prepare: async (fixtures, tenant) => ({
      bookingId: await fixtures.booking(tenant),
    }),
    sameTenant: ({ prepared }) =>
      restCall('DELETE', `/bookings/${prepared.bookingId}`),
  },
];
